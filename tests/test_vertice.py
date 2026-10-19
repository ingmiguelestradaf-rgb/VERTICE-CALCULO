import os, sys, tempfile, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from vertice import concreto as C, cimentacion, mamposteria as M, sismo as S, costos, programa as P, dibujo as D, cargas
from vertice.materiales import Concreto, Acero

class TestConcreto(unittest.TestCase):
    def test_flexion_calculo_manual(self):
        # b=25, d=45, f'c=250, fy=4200, Mu=12 t·m → ρ = 0.006717, As = 7.56 cm² (cálculo a mano)
        r = C.flexion_rectangular(C.tm_a_kgcm(12), 25, 45)
        self.assertAlmostEqual(r.As_req, 7.557, places=2)
        self.assertTrue(r.cumple)
        self.assertGreaterEqual(r.phiMn, 12e5)

    def test_acero_minimo(self):
        r = C.flexion_rectangular(C.tm_a_kgcm(1), 25, 45)
        self.assertAlmostEqual(r.As_diseno, 14 / 4200 * 25 * 45, places=3)

    def test_cortante_vc(self):
        r = C.cortante_viga(5000, 25, 45)
        self.assertAlmostEqual(r.Vc, 0.53 * 250 ** 0.5 * 25 * 45, places=1)
        self.assertLessEqual(r.s_diseno, 22.5)

    def test_columna_diagrama(self):
        capas = C.capas_rectangular(30, 30, num_esq=6, n_cara_b=2, n_cara_h=2)
        res = C.revisar_columna(40000, C.tm_a_kgcm(3), 30, 30, capas)
        self.assertTrue(res["cumple"], res)
        self.assertGreater(res["phiMn"], 3e5)
        # 4#6: ρ = 1.27 %; φPn,max = 0.8·0.65·[0.85f'c(Ag−Ast)+fy·Ast]
        self.assertAlmostEqual(res["Pmax"] / 1000, 0.52 * (0.85 * 250 * (900 - 4 * 2.85) + 4200 * 4 * 2.85) / 1000, places=1)

    def test_traslape(self):
        self.assertGreater(C.traslape(4), 40)

class TestCimentacion(unittest.TestCase):
    def test_zapata(self):
        z = cimentacion.zapata_aislada(P_serv=40, Pu=56, c1=30, c2=30, q_adm=15)
        self.assertTrue(z.cumple)
        self.assertLessEqual(z.q_serv, 15)
        self.assertGreaterEqual(z.d, 15)

class TestSismo(unittest.TestCase):
    def test_espectro_y_estatico(self):
        e = S.Espectro.cfe_parametrico(a0=0.25, c=0.75, Ta=0.1, Tb=0.6, k=1.5, r=0.5, Q=2, R0=2)
        self.assertAlmostEqual(e.elastica(0.3), 0.75, places=3)
        niveles = [S.Nivel("N1", 60, 3.0, 3.0, 20000), S.Nivel("N2", 50, 6.0, 3.0, 18000)]
        r = S.metodo_estatico(niveles, e, limite=0.015)
        self.assertAlmostEqual(sum(f for _, f, _ in r.fuerzas), r.Vbase, places=6)
        self.assertEqual(len(r.distorsiones), 2)

class TestMamposteria(unittest.TestCase):
    def test_fae(self):
        self.assertEqual(M.Muro("1", "X", 300, 15, 250).FAE, 1.0)
        self.assertLess(M.Muro("2", "X", 150, 15, 250).FAE, 1.0)

class TestCostos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        d = os.path.join(os.path.dirname(__file__), "..", "datos")
        cls.db = costos.BaseDatos(os.path.join(d, "precios.json"), os.path.join(d, "mano-obra.json"))

    def test_fsr_rango(self):
        r = self.db.fsr(630)
        self.assertEqual(r["Tl"], 289)
        self.assertTrue(1.6 < r["FSR"] < 1.95, r)

    def test_apu_y_presupuesto(self):
        a = costos.apu_desde_base(self.db, "block-15")
        self.assertGreater(a.costo_directo, 300)
        p = costos.Presupuesto("Prueba", area_construida=100).agregar(a, 100)
        self.assertAlmostEqual(p.subtotal, a.costo_directo * p.sobrecosto.factor * 100, places=4)
        with tempfile.TemporaryDirectory() as t:
            p.a_excel(os.path.join(t, "p.xlsx"))

class TestPrograma(unittest.TestCase):
    def test_cpm(self):
        pr = P.Programa("t")
        pr.agregar("A", "a", 3, costo=100); pr.agregar("B", "b", 2, ["A"], costo=100)
        pr.agregar("C", "c", 6, ["A"], costo=100); pr.agregar("D", "d", 1, ["B", "C"], costo=100)
        self.assertEqual(pr.calcular(), 10)
        self.assertEqual([a.id for a in pr.ruta_critica], ["A", "C", "D"])
        self.assertAlmostEqual(sum(pr.costo_por_semana()), 400, places=6)
        filas, res = P.flujo_de_caja(pr, 500)
        self.assertAlmostEqual(sum(f["ingresos"] for f in filas), 500, places=6)
        self.assertAlmostEqual(sum(f["egresos"] for f in filas), 400, places=6)

    def test_tir(self):
        self.assertAlmostEqual(P.tir([-100, 110]), 0.10, places=5)

class TestDibujo(unittest.TestCase):
    def test_dxf(self):
        h = D.hoja(D.DatosPlano("Prueba", clave="E-99", notas=D.NOTAS_ESTRUCTURALES))
        D.seccion_rectangular(h, 60, 400, 20, "T-1", 25, 50, 4, [(2, 5)], [(3, 5)], 3, "@ 20")
        with tempfile.TemporaryDirectory() as t:
            ruta = h.guardar_dxf(os.path.join(t, "x.dxf"))
            txt = open(ruta, encoding="cp1252").read()
            self.assertTrue(txt.startswith("0\nSECTION"))
            self.assertTrue(txt.rstrip().endswith("EOF"))
            self.assertIn("AC1009", txt)

if __name__ == "__main__":
    unittest.main()
