// Texto de los contratos del contratista general conforme a la legislación de Baja California.
// Cada función recibe `h` (ayudantes de llenado) y regresa {titulo, partes, preambulo, declaraciones, clausulas, anexos, firmas}.
// Numeración del Código Civil para el Estado de Baja California (CCBC) verificada contra la compilación del
// Congreso del Estado; confirma contra el texto vigente antes de firmar (ver references/marco_legal_bc.md).

const ORD = ["PRIMERA","SEGUNDA","TERCERA","CUARTA","QUINTA","SEXTA","SÉPTIMA","OCTAVA","NOVENA","DÉCIMA",
  "DÉCIMA PRIMERA","DÉCIMA SEGUNDA","DÉCIMA TERCERA","DÉCIMA CUARTA","DÉCIMA QUINTA","DÉCIMA SEXTA",
  "DÉCIMA SÉPTIMA","DÉCIMA OCTAVA","DÉCIMA NOVENA","VIGÉSIMA","VIGÉSIMA PRIMERA","VIGÉSIMA SEGUNDA",
  "VIGÉSIMA TERCERA","VIGÉSIMA CUARTA","VIGÉSIMA QUINTA","VIGÉSIMA SEXTA","VIGÉSIMA SÉPTIMA","VIGÉSIMA OCTAVA",
  "VIGÉSIMA NOVENA","TRIGÉSIMA","TRIGÉSIMA PRIMERA","TRIGÉSIMA SEGUNDA","TRIGÉSIMA TERCERA"];

// ---------- periodicidad ----------
const PERIODOS = { semanal: ["semanales", "semanalmente"], quincenal: ["quincenales", "quincenalmente"], mensual: ["mensuales", "mensualmente"],
  catorcenal: ["catorcenales", "cada catorce días"], quincena: ["quincenales", "quincenalmente"], semana: ["semanales", "semanalmente"], mes: ["mensuales", "mensualmente"] };
const perPlural = h => (PERIODOS[String(h.raw("contrato.periodo_estimacion") || "").toLowerCase().trim()] || ["________", ""])[0];
const perAdv = h => (PERIODOS[String(h.raw("contrato.periodo_estimacion") || "").toLowerCase().trim()] || ["", "con la periodicidad pactada"])[1];
const minus = x => x && x[0] !== "_" ? x.charAt(0).toLowerCase() + x.slice(1) : x;

// ---------- declaraciones de cada parte ----------
function declPersona(h, quien, rol, extra) {
  const moral = h.raw(quien + ".tipo_persona") === "moral";
  const nombre = quien === "empresa" ? h.nombreEmpresa() : h.v("contraparte.nombre");
  const out = [];
  if (moral) {
    out.push(`Que es una persona moral legalmente constituida conforme a las leyes mexicanas, como consta en la escritura pública ${h.v(quien + ".escritura_constitutiva")}, y que su objeto social le permite celebrar el presente contrato.`);
    out.push(`Que su representante, ${h.v(quien + ".representante")}, cuenta con facultades suficientes para obligarla en los términos de este contrato, según la escritura pública ${h.v(quien + ".escritura_poder")}, las cuales no le han sido revocadas ni limitadas.`);
  } else {
    out.push(`Que es una persona física mayor de edad, con capacidad legal para contratar y obligarse${quien === "empresa" ? ", que realiza actividades empresariales bajo el nombre comercial «" + h.v("empresa.nombre_comercial") + "»" : ""}, y que se identifica con identificación oficial vigente cuya copia se agrega como anexo.`);
  }
  out.push(`Que cuenta con inscripción en el Registro Federal de Contribuyentes con la clave ${h.v(quien + ".rfc")} y se encuentra al corriente en el cumplimiento de sus obligaciones fiscales, lo que acreditará con su opinión de cumplimiento en sentido positivo emitida por el SAT conforme al artículo 32-D del Código Fiscal de la Federación.`);
  (extra || []).forEach(e => out.push(e));
  out.push(`Que señala como domicilio para oír y recibir notificaciones el ubicado en ${h.v(quien + ".domicilio")}, y como correo electrónico para avisos ${h.v(quien + ".correo")}.`);
  return { titulo: moral ? `Declara ${rol} (${nombre}), por conducto de su representante:` : `Declara ${rol} (${nombre}), por su propio derecho:`, items: out };
}

function declContratistaObra(h) {
  return [
    `Que cuenta con la experiencia, capacidad técnica, financiera, administrativa, personal calificado, maquinaria y equipo necesarios para ejecutar la obra objeto de este contrato.`,
    `Que es patrón con registro patronal ante el Instituto Mexicano del Seguro Social número ${h.v("empresa.registro_patronal")}, y que da cumplimiento a sus obligaciones con el IMSS y el INFONAVIT respecto de los trabajadores que emplee en la obra.`,
    `Que cuenta con registro vigente en el Padrón Público de Contratistas de Servicios Especializados u Obras Especializadas (REPSE) de la Secretaría del Trabajo y Previsión Social número ${h.v("empresa.repse")}, para los casos en que dicho registro resulte exigible conforme al artículo 15 de la Ley Federal del Trabajo.`,
    `Que conoce el sitio de la obra, los planos, especificaciones y demás documentos que integran los anexos, así como las disposiciones de la Ley de Edificaciones del Estado de Baja California, el Reglamento de la Ley de Edificaciones para el Municipio de Tijuana y las Normas Oficiales Mexicanas aplicables, en especial la NOM-031-STPS-2011, Construcción – Condiciones de seguridad y salud en el trabajo.`,
  ];
}

function declPropietario(h) {
  return [
    `Que es propietario o legítimo poseedor del inmueble donde se ejecutará la obra, ubicado en ${h.v("obra.ubicacion")}, ${h.v("obra.municipio")}, o que cuenta con autorización del propietario para encargar los trabajos.`,
    `Que cuenta con la licencia de construcción correspondiente${h.raw("obra.licencia") ? " número " + h.v("obra.licencia") : ""} o se obliga a obtenerla antes del inicio de los trabajos, conforme al artículo 15, fracción I, del Reglamento de la Ley de Edificaciones para el Municipio de Tijuana, así como el Director Responsable de Obra y corresponsables que la autoridad exija.`,
    `Que cuenta con los recursos económicos suficientes para cubrir el precio de la obra en los términos pactados.`,
  ];
}

function declConjunta() {
  return { titulo: "Declaran ambas partes:", items: [
    "Que se reconocen mutuamente la personalidad con que comparecen.",
    "Que en la celebración de este contrato no existe error, dolo, mala fe, lesión ni ningún otro vicio del consentimiento que pudiera invalidarlo.",
    "Que es su voluntad obligarse conforme a las siguientes:",
  ]};
}

// ---------- cláusulas comunes ----------
const C = {
  ivaTxt: h => (Number(h.raw("contrato.iva_pct")) === 8
    ? `el Impuesto al Valor Agregado a la tasa del 8 %, aplicable en la región fronteriza norte conforme al Decreto de estímulos fiscales vigente (prorrogado hasta el 31 de diciembre de 2026). Si el estímulo deja de aplicar o cambia la tasa, se trasladará la tasa vigente en la fecha de cada CFDI, sin que ello modifique el precio antes de impuestos`
    : `el Impuesto al Valor Agregado a la tasa del ${h.p("contrato.iva_pct")}. Si la tasa cambia, se trasladará la vigente en la fecha de cada CFDI, sin que ello modifique el precio antes de impuestos`),

  laboral: (h, quien) => ({ t: "RELACIONES LABORALES Y SEGURIDAD SOCIAL", p: [
    `${quien}, como patrón del personal que ocupe con motivo de este contrato, será el único responsable de las obligaciones derivadas de la Ley Federal del Trabajo, la Ley del Seguro Social, la Ley del INFONAVIT y demás disposiciones en materia de trabajo y seguridad social, en términos del artículo 2515 del Código Civil para el Estado de Baja California. Dicho personal no tendrá relación laboral alguna con la otra parte.`,
    `${quien} se obliga a: (a) inscribir a sus trabajadores ante el IMSS antes de que ingresen a la obra; (b) registrar la obra o vincularse al registro de la obra en el Sistema de Información de Riesgos de Obra de la Construcción (SIROC) del IMSS, conforme al Reglamento del Seguro Social Obligatorio para los Trabajadores de la Construcción por Obra o Tiempo Determinado; (c) entregar mensualmente copia de los CFDI de nómina, de los pagos de cuotas obrero-patronales al IMSS y de aportaciones al INFONAVIT, y de la declaración y pago de las retenciones de ISR de sus trabajadores; (d) respetar la jornada máxima legal vigente y pagar el tiempo extraordinario conforme a la ley.`,
    `${quien} sacará en paz y a salvo a la otra parte de cualquier reclamación, demanda, crédito fiscal o requerimiento de autoridad que se derive del incumplimiento de las obligaciones anteriores, y le reembolsará los gastos y honorarios razonables que ello le ocasione. La otra parte podrá retener de los pagos pendientes el importe de cualquier requerimiento o crédito que se le finque por esta causa, hasta que quede resuelto.`,
  ]}),

  seguridad: h => ({ t: "SEGURIDAD, HIGIENE Y MEDIO AMBIENTE", p: [
    `EL CONTRATISTA cumplirá la NOM-031-STPS-2011 y demás normas de seguridad aplicables: proporcionará a su personal el equipo de protección personal, capacitación y constancias de habilidades (DC-3) que correspondan; mantendrá señalización, protecciones perimetrales, orden y limpieza; contará con un responsable de seguridad en obra y un botiquín de primeros auxilios; y reportará de inmediato todo accidente o incidente.`,
    `Los residuos de la construcción se dispondrán en sitios autorizados por la autoridad municipal. Los empresarios constructores son responsables por la inobservancia de las disposiciones municipales o de policía y por los daños que causen a los vecinos (artículo 2518 del Código Civil para el Estado de Baja California); EL CONTRATISTA responderá frente a la otra parte por esos daños cuando le sean imputables.`,
  ]}),

  seguros: (h, quien = "EL CONTRATISTA", todoRiesgo = false) => ({ t: "SEGUROS", p: [
    `${quien} contratará y mantendrá vigente durante la obra una póliza de responsabilidad civil general por daños a terceros en sus bienes y personas con suma asegurada no menor a ${h.m("contrato.seguro_rc")}${todoRiesgo ? ", así como una póliza de todo riesgo de construcción que cubra la obra, los materiales en sitio y el equipo, por el monto del contrato, en la que EL PROPIETARIO figure como beneficiario preferente" : ""}, y entregará copia de las pólizas antes del inicio de los trabajos. La contratación de seguros no limita la responsabilidad de ${quien} conforme a este contrato.`,
  ]}),

  pena: (h, base, q = "EL CONTRATISTA") => ({ t: "PENA CONVENCIONAL", p: [
    `Si ${q} no concluye los trabajos en el plazo pactado o, en su caso, en el plazo prorrogado por escrito, pagará como pena convencional el ${h.p("contrato.pena_diaria_pct")} por cada día natural de atraso sobre el importe de ${base}, sin que el total de la pena exceda del ${h.p("contrato.pena_tope_pct")} del monto del contrato, en términos de los artículos 1727, 1730 y 1731 del Código Civil para el Estado de Baja California.`,
    `La pena se descontará de los pagos pendientes. No procederá cuando el atraso derive de causas imputables a la otra parte, caso fortuito o fuerza mayor (artículo 1734 del mismo Código), siempre que ${q} lo haya asentado en la bitácora o notificado por escrito dentro de los tres días hábiles siguientes a que tuvo conocimiento del hecho. Por tratarse de una pena por simple retardo, su pago no libera a ${q} de la obligación de terminar los trabajos (artículo 1733).`,
  ]}),

  fuerzaMayor: (renta = false) => ({ t: "CASO FORTUITO Y FUERZA MAYOR", p: renta ? [
    "Ninguna de las partes será responsable del incumplimiento causado por caso fortuito o fuerza mayor, entendidos como acontecimientos imprevisibles o inevitables ajenos a su voluntad. La parte afectada lo notificará por escrito a la otra dentro de los tres días hábiles siguientes y, mientras dure el impedimento que impida usar el equipo, se suspenderá el cómputo del plazo y no se causará renta.",
  ] : [
    "Ninguna de las partes será responsable del incumplimiento causado por caso fortuito o fuerza mayor, entendidos como acontecimientos imprevisibles o inevitables ajenos a su voluntad, tales como sismos, inundaciones, incendios no imputables, epidemias declaradas por autoridad, actos de autoridad o paros generales. La parte afectada deberá notificarlo por escrito a la otra dentro de los tres días hábiles siguientes, con la evidencia disponible, y el programa se prorrogará por el tiempo que dure el impedimento. La escasez o el aumento de precio de materiales o de mano de obra no constituyen caso fortuito ni fuerza mayor.",
  ]}),

  confidencialidad: () => ({ t: "CONFIDENCIALIDAD Y DATOS PERSONALES", p: [
    "Las partes guardarán confidencialidad sobre la información técnica, comercial y financiera que reciban con motivo de este contrato y sólo la usarán para su cumplimiento. Los datos personales que intercambien se tratarán conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares. Esta obligación subsistirá dos años después de terminado el contrato.",
  ]}),

  avisos: (bitacora = true) => ({ t: "AVISOS Y COMUNICACIONES", p: [
    `Todo aviso entre las partes se hará por escrito en los domicilios o correos electrónicos señalados en las declaraciones${bitacora ? ", o mediante asiento en la bitácora de obra cuando se refiera a la ejecución de los trabajos" : ""}. El cambio de domicilio o correo deberá notificarse por escrito; mientras no se haga, los avisos enviados al último domicilio o correo conocido surtirán plenos efectos.`,
  ]}),

  cesion: () => ({ t: "CESIÓN DE DERECHOS", p: [
    "Ninguna de las partes podrá ceder o transmitir total o parcialmente los derechos y obligaciones de este contrato sin el consentimiento previo y por escrito de la otra, salvo los derechos de cobro, que podrán cederse a instituciones de crédito o factoraje previa notificación por escrito.",
  ]}),

  integridad: (prelacion = "el presente contrato, los convenios modificatorios, el catálogo de conceptos o presupuesto, las especificaciones y los planos") => ({ t: "TOTALIDAD DEL CONTRATO Y MODIFICACIONES", p: [
    `Este contrato y sus anexos constituyen el acuerdo completo entre las partes y sustituyen cualquier propuesta, cotización o acuerdo previo. Sólo podrá modificarse mediante convenio por escrito firmado por ambas partes. En caso de contradicción entre documentos prevalecerá, en este orden: ${prelacion}. Si alguna cláusula fuera declarada nula, las demás conservarán su validez.`,
  ]}),

  jurisdiccion: () => ({ t: "LEGISLACIÓN APLICABLE, SOLUCIÓN DE CONTROVERSIAS Y JURISDICCIÓN", p: [
    "Para la interpretación y cumplimiento de este contrato se aplicará el Código Civil para el Estado de Baja California y, en lo que corresponda, la legislación federal en materia laboral, fiscal y de seguridad social.",
    "Las partes procurarán resolver sus diferencias técnicas mediante el dictamen de un perito en la materia designado de común acuerdo, cuyo costo cubrirán por partes iguales, y podrán acudir a la mediación ante el Centro Estatal de Justicia Alternativa del Poder Judicial del Estado de Baja California. Si no llegan a un acuerdo, se someten a la jurisdicción de los tribunales competentes de la ciudad de Tijuana, Baja California, renunciando al fuero que por razón de su domicilio presente o futuro pudiera corresponderles.",
  ]}),
};

// ---------- contrato de obra (precio alzado y precios unitarios comparten estructura) ----------
function contratoObra(h, modalidad) {
  const PA = modalidad === "precio_alzado";
  const cl = [];
  cl.push({ t: "OBJETO", p: [
    `EL PROPIETARIO encomienda a EL CONTRATISTA, y éste se obliga a ejecutar${PA ? " bajo su dirección y con materiales propios, por ajuste cerrado y a precio alzado" : " bajo la modalidad de precios unitarios y tiempo determinado"} la obra denominada «${h.v("obra.nombre")}», ubicada en ${h.v("obra.ubicacion")}, ${h.v("obra.municipio")}, consistente en: ${h.v("obra.descripcion")}`,
    `Los trabajos se ejecutarán conforme a los anexos que, firmados por las partes, forman parte integrante de este contrato: Anexo A (planos y especificaciones), Anexo B (${PA ? "presupuesto desglosado por partidas" : "catálogo de conceptos con cantidades estimadas y precios unitarios"}), Anexo C (programa de obra) ${PA ? "y Anexo D (calendario de pagos por hitos)" : "y Anexo D (análisis de precios unitarios y de indirectos)"}.${PA ? " Este contrato se otorga por escrito con descripción pormenorizada de la obra y su plano, diseño y presupuesto, conforme al artículo 2491 del Código Civil para el Estado de Baja California." : ""}`,
  ]});
  if (PA) {
    cl.push({ t: "PRECIO ALZADO", p: [
      `El precio total y fijo de la obra es de ${h.m("contrato.monto")}, más ${C.ivaTxt(h)}. El importe con IVA asciende a ${h.mTotal()}.`,
      `El precio incluye materiales, mano de obra, herramienta, maquinaria y equipo, fletes, acarreos, indirectos, financiamiento, utilidad, cargos por limpieza y retiro de escombro, así como todo lo necesario para entregar la obra terminada y funcionando. Conforme al artículo 2499 del Código Civil para el Estado de Baja California, EL CONTRATISTA no tendrá derecho a exigir aumento alguno aunque lo haya tenido el precio de los materiales o de los jornales.`,
      `Sólo se modificará el precio por cambios o aumentos al proyecto autorizados por escrito por EL PROPIETARIO con expresa designación de su precio y del ajuste al plazo, en términos del artículo 2500 del mismo Código, mediante el procedimiento de la cláusula de ÓRDENES DE CAMBIO.`,
    ]});
  } else {
    cl.push({ t: "MONTO Y PRECIOS UNITARIOS", p: [
      `El monto estimado de este contrato es de ${h.m("contrato.monto")}, más ${C.ivaTxt(h)}. El importe estimado con IVA asciende a ${h.mTotal()}. Dicho monto resulta de multiplicar las cantidades estimadas del Anexo B por los precios unitarios pactados; el importe definitivo será el que resulte de los volúmenes realmente ejecutados, medidos y aceptados.`,
      `Los precios unitarios incluyen costo directo, indirectos, financiamiento, utilidad y cargos adicionales y permanecerán fijos durante la vigencia del contrato, salvo el procedimiento de ajuste de costos de la cláusula correspondiente.`,
      `Las cantidades del Anexo B son estimadas. Cuando un concepto aumente o disminuya más de un 25 % respecto de la cantidad contratada, cualquiera de las partes podrá solicitar la revisión de su precio unitario por lo que exceda o falte de dicho porcentaje, acreditándolo con el análisis correspondiente.`,
    ]});
    cl.push({ t: "CONCEPTOS FUERA DE CATÁLOGO Y VOLÚMENES ADICIONALES", p: [
      `Los trabajos no previstos en el catálogo sólo se ejecutarán previa orden por escrito de EL PROPIETARIO o su supervisión. EL CONTRATISTA presentará el análisis del precio unitario extraordinario dentro de los cinco días hábiles siguientes a la orden, integrado con los mismos costos de insumos, indirectos y utilidad de su propuesta original. Las partes conciliarán el precio dentro de los cinco días hábiles siguientes; mientras tanto podrá pagarse provisionalmente el 80 % del precio propuesto.`,
    ]});
    cl.push({ t: "AJUSTE DE COSTOS", p: [
      `Si durante la ejecución ocurren circunstancias de orden económico no previstas que incrementen o reduzcan en más de un 5 % el costo directo de los trabajos pendientes de ejecutar, cualquiera de las partes podrá solicitar el ajuste de los precios unitarios afectados, con base en la variación de los índices del Instituto Nacional de Estadística y Geografía (INPP para construcción) o, en su defecto, de cotizaciones documentadas, aplicado únicamente al importe de los trabajos pendientes conforme al programa vigente. No procederá ajuste sobre trabajos atrasados por causas imputables a EL CONTRATISTA.`,
    ]});
  }
  cl.push({ t: "ANTICIPO", p: [
    `EL PROPIETARIO entregará a EL CONTRATISTA un anticipo del ${h.p("contrato.anticipo_pct")} del monto del contrato, más IVA, dentro de los cinco días hábiles siguientes a la firma${h.raw("contrato.fianza_anticipo") ? " y a la entrega de la fianza de anticipo" : ""}, contra el CFDI correspondiente. El anticipo se destinará a la compra de materiales, equipo e inicio de los trabajos.`,
    `El anticipo se amortizará descontando de cada ${PA ? "pago" : "estimación"} un porcentaje igual al del anticipo (${h.p("contrato.anticipo_pct")}) sobre su importe, de modo que quede totalmente amortizado en el último pago. Los materiales adquiridos con el anticipo y entregados en la obra pasarán a propiedad de EL PROPIETARIO al amortizarse, y quedarán bajo custodia y riesgo de EL CONTRATISTA hasta la entrega de la obra. El atraso en la entrega del anticipo prorrogará en igual plazo la fecha de inicio y de terminación.`,
  ]});
  cl.push({ t: PA ? "FORMA DE PAGO" : "ESTIMACIONES Y FORMA DE PAGO", p: PA ? [
    `El saldo del precio se pagará conforme al calendario de pagos por hitos del Anexo D, contra avance físico verificado por EL PROPIETARIO o su supervisión, y la entrega del CFDI respectivo. A cada pago se le descontará la amortización proporcional del anticipo y una retención del ${h.p("contrato.fondo_garantia_pct")} como fondo de garantía.`,
    `EL CONTRATISTA presentará la solicitud de pago con reporte fotográfico y avance; EL PROPIETARIO la revisará dentro de los ${h.v("contrato.dias_revision")} días hábiles siguientes y pagará dentro de los ${h.v("contrato.dias_pago")} días naturales siguientes a su aprobación, mediante transferencia a la cuenta CLABE ${h.v("empresa.clabe")} de ${h.v("empresa.banco")}. Si EL PROPIETARIO no formula observaciones en el plazo de revisión, la solicitud se tendrá por aprobada.`,
    `Los pagos parciales se hacen a cuenta del precio y no implican la aceptación de los trabajos, por lo que no opera la presunción del artículo 2504 del Código Civil para el Estado de Baja California. Una vez pagado y recibido el precio total, no habrá lugar a reclamación sobre él salvo que alguna de las partes se haya reservado expresamente ese derecho en el finiquito (artículo 2501).`,
  ] : [
    `EL CONTRATISTA presentará estimaciones ${perPlural(h)} de los trabajos ejecutados, acompañadas de números generadores, croquis, reporte fotográfico, pruebas de calidad aplicables y la carátula de estimación, conforme al formato de estimaciones de EL CONTRATISTA o al que acuerden las partes, dentro de los cinco días hábiles siguientes al cierre de cada periodo. Los trabajos no estimados en plazo se incluirán en la estimación siguiente, sin que generen intereses por el retraso en su cobro.`,
    `EL PROPIETARIO o su supervisión revisarán la estimación dentro de los ${h.v("contrato.dias_revision")} días hábiles siguientes. Las diferencias se resolverán en la estimación siguiente sin detener el pago de lo no controvertido. Si no se formulan observaciones en ese plazo, la estimación se tendrá por aprobada. El pago se hará dentro de los ${h.v("contrato.dias_pago")} días naturales siguientes a la aprobación y entrega del CFDI, mediante transferencia a la cuenta CLABE ${h.v("empresa.clabe")} de ${h.v("empresa.banco")}.`,
    `De cada estimación se deducirán: (a) la amortización del anticipo en el ${h.p("contrato.anticipo_pct")} de su importe; (b) una retención del ${h.p("contrato.fondo_garantia_pct")} como fondo de garantía; y (c) las penas convencionales que en su caso procedan.`,
    `El pago de las estimaciones se hace a cuenta del total y no implica la aceptación de los trabajos estimados, por lo que no opera la presunción del artículo 2504 del Código Civil para el Estado de Baja California; la recepción se formaliza en términos de la cláusula de RECEPCIÓN Y FINIQUITO. EL CONTRATISTA tiene derecho a que la obra se le pague en proporción a lo ejecutado (artículo 2503).`,
  ]});
  cl.push({ t: "FONDO DE GARANTÍA", p: [
    `Las retenciones del fondo de garantía se devolverán a EL CONTRATISTA dentro de los treinta días naturales siguientes a que entregue la fianza de vicios ocultos a que se refiere la cláusula de GARANTÍAS, una vez firmada el acta de entrega-recepción sin pendientes. Si EL CONTRATISTA opta por no entregar dicha fianza, el fondo se conservará durante el periodo de garantía de ${h.v("contrato.vicios_meses")} meses y se devolverá al vencer éste, descontando el costo de los vicios que no haya atendido. Las retenciones no generan intereses.`,
  ]});
  cl.push({ t: "INTERESES MORATORIOS", p: [
    `Si EL PROPIETARIO no paga en los plazos convenidos, cubrirá a EL CONTRATISTA intereses moratorios a razón del ${h.p("contrato.interes_moratorio_pct_mensual")} mensual sobre las cantidades vencidas, calculados por días naturales desde el vencimiento hasta su pago. Si el atraso excede de treinta días naturales, EL CONTRATISTA podrá suspender los trabajos previo aviso por escrito con cinco días hábiles de anticipación, y el programa se prorrogará por el tiempo de la suspensión más el necesario para reanudar.`,
  ]});
  cl.push({ t: "PLAZO DE EJECUCIÓN", p: [
    `EL CONTRATISTA iniciará los trabajos el ${h.v("contrato.fecha_inicio")} y los concluirá a más tardar el ${h.v("contrato.fecha_termino")}, en un plazo de ${h.v("contrato.plazo_dias")} días naturales, conforme al programa del Anexo C${PA ? " y al artículo 2502 del Código Civil para el Estado de Baja California" : ""}. Para iniciar será necesario que EL PROPIETARIO haya entregado el anticipo, el sitio libre de obstáculos, la licencia de construcción y los planos autorizados.`,
    `El plazo se prorrogará por escrito, en la misma medida del retraso, cuando éste derive de: atraso en pagos o en la entrega del anticipo, sitio o información; órdenes de cambio; suspensiones ordenadas por EL PROPIETARIO o por autoridad sin culpa de EL CONTRATISTA; y caso fortuito o fuerza mayor.`,
  ]});
  cl.push({ t: "ÓRDENES DE CAMBIO Y TRABAJOS EXTRAORDINARIOS", p: [
    `Toda modificación al proyecto, especificaciones o alcances se formalizará mediante orden de cambio por escrito firmada por ambas partes, que indique la descripción del cambio, su importe y su efecto en el plazo. Sin orden de cambio firmada, EL CONTRATISTA no estará obligado a ejecutar el cambio ni EL PROPIETARIO a pagarlo, salvo trabajos urgentes para evitar un daño inminente, que se notificarán por escrito dentro de las veinticuatro horas siguientes.`,
  ]});
  cl.push({ t: "OBLIGACIONES DE EL CONTRATISTA", p: [
    "Además de las previstas en otras cláusulas, EL CONTRATISTA se obliga a:",
  ], items: [
    "Ejecutar la obra conforme al proyecto, especificaciones, normas técnicas aplicables y buenas prácticas de construcción, empleando materiales nuevos y de la calidad especificada.",
    "Designar un superintendente de obra con facultades para decidir sobre la ejecución, que permanecerá en el sitio durante la jornada.",
    "Llevar la bitácora de obra y permitir en ella los asientos del Director Responsable de Obra, corresponsables y supervisión, conforme al artículo 17 del Reglamento de la Ley de Edificaciones para el Municipio de Tijuana.",
    "Realizar a su costa las pruebas de laboratorio que exijan las especificaciones (resistencia de concreto, compactación y las demás aplicables) y entregar sus resultados.",
    "Ser responsable del trabajo ejecutado por las personas que ocupe en la obra (artículo 2515 del Código Civil para el Estado de Baja California) y no subcontratar trabajos sin el consentimiento previo y por escrito de EL PROPIETARIO; si lo obtiene, los trabajos se harán siempre bajo su responsabilidad (artículo 2506).",
    "Cuidar y conservar la obra, materiales y equipos hasta su entrega, y retirar al terminar el equipo, materiales sobrantes y escombro, dejando el sitio limpio.",
    "Advertir por escrito a EL PROPIETARIO de los defectos que detecte en el proyecto, en los materiales que éste le proporcione o en el terreno, antes de ejecutar los trabajos afectados.",
    "Entregar al término los planos de obra terminada, manuales, garantías de fabricantes y la documentación necesaria para el aviso de terminación de obra.",
  ]});
  cl.push({ t: "OBLIGACIONES DE EL PROPIETARIO", p: [
    "EL PROPIETARIO se obliga a:",
  ], items: [
    "Pagar el precio en la forma y plazos pactados.",
    "Entregar el sitio de la obra libre de obstáculos, con acceso y con los servicios provisionales que se acuerden.",
    "Tramitar y pagar la licencia de construcción y los derechos municipales, y contratar al Director Responsable de Obra y a los corresponsables, salvo que las partes pacten otra cosa por escrito.",
    "Entregar oportunamente los planos, especificaciones y definiciones que se requieran para la ejecución, y contestar por escrito las consultas técnicas dentro de los tres días hábiles siguientes.",
    "Designar a un representante o supervisión que tendrá facultades para aprobar avances, estimaciones y órdenes de cambio.",
    "Recibir la obra cuando esté concluida en los términos de este contrato.",
  ]});
  cl.push({ t: "SUPERVISIÓN Y BITÁCORA", p: [
    `EL PROPIETARIO podrá supervisar los trabajos directamente o por medio de un tercero (${h.v("obra.supervisor")}), quien podrá rechazar los trabajos que no cumplan con el proyecto y ordenar su corrección a costa de EL CONTRATISTA. La supervisión no releva a EL CONTRATISTA de su responsabilidad.`,
    "La bitácora de obra será el medio oficial de comunicación entre las partes para asuntos técnicos; se abrirá en la fecha de inicio, sus hojas estarán foliadas y cada asiento se firmará por quien lo realiza. Las instrucciones que impliquen costo o plazo adicional sólo serán exigibles una vez formalizadas como orden de cambio.",
  ]});
  cl.push({ t: "RIESGO DE LA OBRA", p: [
    "Todo el riesgo de la obra correrá a cargo de EL CONTRATISTA hasta el acto de la entrega, salvo que EL PROPIETARIO incurra en mora para recibirla, en cuyo caso el riesgo pasará a éste desde que se le notifique por escrito que la obra está lista para su recepción (artículo 2490 del Código Civil para el Estado de Baja California).",
  ]});
  cl.push(C.laboral(h, "EL CONTRATISTA"));
  cl.push({ t: "PAGO A SUBCONTRATISTAS Y PROVEEDORES", p: [
    "EL CONTRATISTA pagará oportunamente a sus subcontratistas, proveedores y trabajadores. Quienes trabajen por su cuenta o le suministren material no tendrán acción contra EL PROPIETARIO sino hasta la cantidad que éste adeude a EL CONTRATISTA (artículo 2514 del Código Civil para el Estado de Baja California). Si algún subcontratista o proveedor reclama a EL PROPIETARIO o embarga la obra, éste podrá retener de los pagos pendientes el importe reclamado hasta que EL CONTRATISTA acredite haberlo resuelto.",
  ]});
  cl.push(C.seguridad(h));
  cl.push(C.seguros(h, "EL CONTRATISTA", true));
  cl.push({ t: "GARANTÍAS", p: [
    `Para garantizar sus obligaciones, EL CONTRATISTA entregará, expedidas por institución afianzadora autorizada y a favor de EL PROPIETARIO: ${(() => { const L = []; if (h.raw("contrato.fianza_anticipo")) L.push("fianza por el importe total del anticipo, con IVA, dentro de los cinco días hábiles siguientes a la firma, que se cancelará al quedar amortizado"); L.push(`fianza de cumplimiento por el ${h.p("contrato.fianza_cumplimiento_pct")} del monto del contrato, sin IVA, vigente hasta la firma del acta de entrega-recepción`); L.push(`a la entrega de la obra, fianza de vicios ocultos por el ${h.p("contrato.fianza_vicios_pct")} del monto ejercido, vigente por ${h.v("contrato.vicios_meses")} meses, la cual podrá sustituirse por la conservación del fondo de garantía en los términos de la cláusula de FONDO DE GARANTÍA`); return L.map((x, i) => `(${"abc"[i]}) ${x}`).join("; ").replace(/; (\([bc]\)) (?!.*; \()/, "; y $1 "); })()}.`,
    `Independientemente de las fianzas, EL CONTRATISTA responderá de los defectos que aparezcan después de recibida la obra y que procedan de vicios en su construcción y hechura o de mala calidad de los materiales empleados, salvo que EL PROPIETARIO haya ordenado expresamente el uso de materiales defectuosos o un terreno inapropiado a pesar de las observaciones escritas de EL CONTRATISTA (artículo 2507 del Código Civil para el Estado de Baja California). EL CONTRATISTA atenderá las reclamaciones por vicios dentro de los diez días hábiles siguientes a su notificación.`,
  ]});
  cl.push({ t: "RECEPCIÓN Y FINIQUITO", p: [
    "Concluidos los trabajos, EL CONTRATISTA lo notificará por escrito. Dentro de los cinco días hábiles siguientes las partes harán un recorrido y levantarán una lista de pendientes; EL CONTRATISTA los atenderá en el plazo que se fije. Atendidos los pendientes, se firmará el acta de entrega-recepción, que hará constar la fecha de recepción y la entrega de planos de obra terminada, manuales y garantías.",
    "Si EL PROPIETARIO no acude al recorrido o no firma el acta sin causa justificada dentro de los diez días hábiles siguientes a la notificación, la obra se tendrá por recibida. Cuando se haya pactado que la obra se haga a satisfacción del propietario, la aprobación se entenderá reservada a juicio de peritos (artículo 2516).",
    "Dentro de los treinta días naturales siguientes a la recepción las partes elaborarán el finiquito, que incluirá los créditos a favor y en contra de cada parte, la devolución del fondo de garantía y el saldo a pagar.",
  ]});
  cl.push(C.pena(h, PA ? "los trabajos no concluidos conforme al programa" : "los trabajos no ejecutados conforme al programa"));
  cl.push({ t: "SUSPENSIÓN Y DESISTIMIENTO", p: [
    "EL PROPIETARIO podrá suspender temporalmente los trabajos por causa justificada mediante aviso por escrito; el plazo se prorrogará y EL PROPIETARIO pagará a EL CONTRATISTA los gastos no recuperables comprobados que la suspensión le ocasione. Si la suspensión excede de sesenta días naturales, EL CONTRATISTA podrá dar por terminado el contrato.",
    PA ? "EL PROPIETARIO podrá desistir de la obra comenzada, con tal que indemnice a EL CONTRATISTA de todos los gastos y trabajos y de la utilidad que pudiera haber obtenido de la obra (artículo 2508 del Código Civil para el Estado de Baja California)."
       : "EL PROPIETARIO podrá dar por terminado anticipadamente el contrato mediante aviso por escrito con diez días hábiles de anticipación, pagando a EL CONTRATISTA los trabajos ejecutados, los materiales adquiridos para la obra que le entregue, los gastos no recuperables comprobados y la utilidad pactada sobre los trabajos ejecutados.",
  ]});
  cl.push({ t: "RESCISIÓN", p: [
    "Cualquiera de las partes podrá rescindir este contrato sin necesidad de declaración judicial, mediante aviso por escrito que exprese la causa, cuando la otra incumpla sus obligaciones y no subsane el incumplimiento dentro de los diez días hábiles siguientes a que se le requiera por escrito. Son causas de rescisión imputables a EL CONTRATISTA, entre otras: no iniciar los trabajos en la fecha pactada, suspenderlos injustificadamente, un atraso mayor al 20 % respecto del programa, subcontratar sin autorización, o incumplir sus obligaciones laborales y de seguridad social. Es causa imputable a EL PROPIETARIO, entre otras, la falta de pago por más de treinta días naturales.",
    "Al rescindirse, se levantará un acta circunstanciada del estado de la obra, se pagarán los trabajos ejecutados y aceptados, se liquidarán las penas y daños que correspondan, y EL CONTRATISTA reintegrará el anticipo no amortizado dentro de los diez días hábiles siguientes. EL PROPIETARIO quedará en libertad de continuar la obra con otras personas.",
  ]});
  cl.push({ t: "MUERTE O IMPOSIBILIDAD", p: [
    "Si EL CONTRATISTA, siendo persona física, fallece o no puede concluir la obra por causa independiente de su voluntad, el contrato podrá rescindirse y EL PROPIETARIO pagará a sus herederos o a él mismo el trabajo y gastos hechos (artículos 2511 y 2512 del Código Civil para el Estado de Baja California). Si fallece EL PROPIETARIO, el contrato no se rescindirá y sus herederos serán responsables de su cumplimiento (artículo 2513).",
  ]});
  cl.push({ t: "PROPIEDAD INTELECTUAL", p: [
    "Los planos, diseños y presupuestos que EL CONTRATISTA elabore para esta obra se incluyen en el precio y podrán ser usados por EL PROPIETARIO únicamente para construir, operar y mantener esta obra (artículos 2493 a 2496 del Código Civil para el Estado de Baja California). Su uso para otras obras requerirá autorización por escrito de su autor.",
  ]});
  cl.push(C.fuerzaMayor(), C.confidencialidad(), C.cesion(), C.avisos(), C.integridad(), C.jurisdiccion());

  return {
    titulo: PA ? "CONTRATO DE OBRA A PRECIO ALZADO" : "CONTRATO DE OBRA A PRECIOS UNITARIOS Y TIEMPO DETERMINADO",
    archivo: PA ? "Contrato_Obra_Precio_Alzado" : "Contrato_Obra_Precios_Unitarios",
    partes: [["EL PROPIETARIO", "contraparte"], ["EL CONTRATISTA", "empresa"]],
    declaraciones: [
      declPersona(h, "contraparte", "EL PROPIETARIO", declPropietario(h)),
      declPersona(h, "empresa", "EL CONTRATISTA", declContratistaObra(h)),
      declConjunta(),
    ],
    clausulas: cl,
    anexos: PA ? ["A. Planos y especificaciones", "B. Presupuesto desglosado por partidas", "C. Programa de obra", "D. Calendario de pagos por hitos", "E. Copias de identificaciones, poderes, constancias de situación fiscal y REPSE"]
               : ["A. Planos y especificaciones", "B. Catálogo de conceptos con cantidades y precios unitarios", "C. Programa de obra", "D. Análisis de precios unitarios, indirectos y factor de sobrecosto", "E. Copias de identificaciones, poderes, constancias de situación fiscal y REPSE"],
  };
}

// ---------- subcontrato de obra especializada ----------
function subcontrato(h) {
  const cl = [];
  cl.push({ t: "OBJETO", p: [
    `EL SUBCONTRATISTA se obliga a ejecutar, con sus propios elementos y bajo su dirección, los trabajos especializados de ${minus(h.v("subcontrato.especialidad"))} en la obra «${h.v("obra.nombre")}», ubicada en ${h.v("obra.ubicacion")}, ${h.v("obra.municipio")}, conforme a los alcances, planos, especificaciones, catálogo y programa de los Anexos A a D.`,
    `Las partes reconocen que los trabajos objeto de este contrato constituyen una obra especializada en términos de los artículos 13 y 14 de la Ley Federal del Trabajo, que no forma parte del objeto social ni de la actividad económica preponderante de EL CONTRATISTA, y que EL SUBCONTRATISTA la ejecutará con trabajadores bajo su exclusiva dependencia y dirección. Para su ejecución EL SUBCONTRATISTA empleará aproximadamente ${h.v("subcontrato.trabajadores_aprox")} trabajadores, dato que se señala conforme al artículo 13 de la Ley Federal del Trabajo.`,
    `Este subcontrato deriva del contrato principal ${h.v("subcontrato.contrato_principal")} celebrado entre EL CONTRATISTA y el propietario de la obra, cuyas especificaciones técnicas, normas de calidad, reglas de seguridad y de acceso al sitio EL SUBCONTRATISTA declara conocer y se obliga a cumplir en lo que corresponda a sus trabajos.`,
  ]});
  cl.push({ t: "REGISTRO REPSE Y OBLIGACIONES LABORALES Y FISCALES", p: [
    `EL SUBCONTRATISTA declara contar con registro vigente en el Padrón Público de Contratistas de Servicios Especializados u Obras Especializadas (REPSE) número ${h.v("contraparte.repse")}, que ampara la actividad objeto de este contrato, y se obliga a mantenerlo vigente durante todo el contrato y a renovarlo oportunamente. La falta o cancelación del registro será causa de rescisión inmediata.`,
    "EL SUBCONTRATISTA entregará a EL CONTRATISTA, dentro de los cinco días hábiles siguientes al cierre de cada mes y como condición para el pago de las estimaciones del periodo: (a) copia de los CFDI de nómina de los trabajadores asignados a la obra; (b) comprobantes de pago de las cuotas obrero-patronales al IMSS y de las aportaciones al INFONAVIT; (c) declaración y pago de las retenciones de ISR por salarios; y (d) declaración de IVA y su acuse de pago, conforme a los artículos 27, fracción V, de la Ley del Impuesto sobre la Renta y 5, fracción II, de la Ley del IVA, en relación con el artículo 15-D del Código Fiscal de la Federación.",
    "Asimismo, presentará en tiempo y entregará copia de los acuses de: la información cuatrimestral al IMSS (ICSOE) prevista en el artículo 15-A de la Ley del Seguro Social, la información cuatrimestral al INFONAVIT (SISUB) prevista en el artículo 29 Bis de su ley, y su vinculación al registro de la obra en el SIROC del IMSS antes de ingresar a la obra.",
    "Las partes reconocen que, conforme al artículo 14 de la Ley Federal del Trabajo, EL CONTRATISTA responde solidariamente si EL SUBCONTRATISTA incumple sus obligaciones con los trabajadores asignados; por ello, EL CONTRATISTA podrá retener los pagos mientras no reciba completa la documentación anterior, sin que la retención genere intereses ni se considere incumplimiento de su parte.",
  ]});
  cl.push({ t: "PRECIO Y PRECIOS UNITARIOS", p: [
    `El importe estimado de este subcontrato es de ${h.m("contrato.monto")}, más ${C.ivaTxt(h)}. El importe estimado con IVA asciende a ${h.mTotal()}. Se pagará por volúmenes realmente ejecutados y aceptados a los precios unitarios del Anexo B, que incluyen todos los costos directos, indirectos, utilidad y obligaciones laborales y fiscales de EL SUBCONTRATISTA y permanecerán fijos durante el contrato.`,
    h.raw("subcontrato.retencion_iva_aplica")
      ? "EL CONTRATISTA retendrá el 6 % del valor de la contraprestación por concepto de IVA, en términos del artículo 1-A, fracción IV, de la Ley del IVA, y entregará la constancia correspondiente."
      : "Las partes manifiestan que, por la naturaleza de los trabajos, EL SUBCONTRATISTA no pone personal a disposición de EL CONTRATISTA; si la autoridad fiscal determinara que procede la retención de IVA prevista en el artículo 1-A, fracción IV, de la Ley del IVA, EL CONTRATISTA la aplicará a partir de que así se determine.",
    "Los trabajos fuera de catálogo, los cambios de alcance y los volúmenes adicionales sólo se ejecutarán con orden de cambio por escrito de EL CONTRATISTA que indique el precio unitario conciliado y su efecto en el plazo; sin ella, no serán exigibles ni pagaderos.",
  ]});
  cl.push({ t: "ANTICIPO, ESTIMACIONES Y PAGO", p: [
    `${Number(h.raw("contrato.anticipo_pct")) > 0 ? `EL CONTRATISTA otorgará un anticipo del ${h.p("contrato.anticipo_pct")} del importe del subcontrato, contra fianza de anticipo y CFDI, que se amortizará proporcionalmente en cada estimación. ` : ""}EL SUBCONTRATISTA presentará estimaciones ${perPlural(h)} con números generadores, reporte fotográfico y la documentación a que se refiere la cláusula SEGUNDA. EL CONTRATISTA las revisará dentro de los ${h.v("contrato.dias_revision")} días hábiles siguientes.`,
    `De cada estimación se deducirán la amortización del anticipo, una retención del ${h.p("contrato.fondo_garantia_pct")} como fondo de garantía y las penas que procedan. EL CONTRATISTA pagará cada estimación aprobada dentro de los ${h.v("subcontrato.dias_pago_tras_cobro")} días hábiles siguientes a que el propietario de la obra le pague la estimación del contrato principal que incluya esos trabajos y, en todo caso, a más tardar ${h.v("subcontrato.dias_pago_maximo")} días naturales después de su aprobación, salvo que el propietario rechace los trabajos por causas imputables a EL SUBCONTRATISTA.`,
    "El pago de estimaciones no implica la aceptación de los trabajos, que se formaliza con el acta de entrega-recepción.",
    `Si EL CONTRATISTA no paga en el plazo máximo señalado, cubrirá intereses moratorios del ${h.p("contrato.interes_moratorio_pct_mensual")} mensual sobre lo vencido, salvo que la falta de pago derive de la retención prevista en la cláusula SEGUNDA. El fondo de garantía se devolverá dentro de los treinta días naturales siguientes a la entrega de la fianza de vicios ocultos o, si no se entrega, al vencer el periodo de garantía.`,
  ]});
  cl.push({ t: "PLAZO Y PROGRAMA", p: [
    `EL SUBCONTRATISTA iniciará los trabajos el ${h.v("contrato.fecha_inicio")} y los concluirá a más tardar el ${h.v("contrato.fecha_termino")} (${h.v("contrato.plazo_dias")} días naturales), coordinándose con el programa general de la obra y con los demás contratistas. Participará en las juntas semanales de coordinación y en la planeación semanal de EL CONTRATISTA, y cumplirá los compromisos que en ellas adquiera.`,
  ]});
  cl.push({ t: "DIRECCIÓN TÉCNICA Y CALIDAD", p: [
    "EL SUBCONTRATISTA designará un responsable técnico permanente en la obra. Ejecutará los trabajos con personal calificado, materiales nuevos y de la calidad especificada y realizará las pruebas que exijan las normas de su especialidad (por ejemplo, pruebas de hermeticidad, de aislamiento o de continuidad), entregando sus resultados. EL CONTRATISTA y la supervisión del propietario podrán rechazar los trabajos defectuosos, que EL SUBCONTRATISTA corregirá a su costa.",
  ]});
  cl.push({ t: "BITÁCORA, RIESGO Y CUSTODIA", p: [
    "Las instrucciones técnicas y los avisos sobre la ejecución se asentarán en la bitácora de la obra o en el registro de órdenes de EL CONTRATISTA. Los trabajos, materiales y herramienta de EL SUBCONTRATISTA quedarán bajo su riesgo y custodia hasta la firma del acta de entrega-recepción de sus trabajos; EL CONTRATISTA le asignará un área de almacenamiento sin responder por pérdidas que no le sean imputables.",
  ]});
  cl.push(C.laboral(h, "EL SUBCONTRATISTA"));
  cl.push({ t: "SEGURIDAD, ACCESO Y CONTROL DE PERSONAL", p: [
    "EL SUBCONTRATISTA cumplirá la NOM-031-STPS-2011 y el reglamento de seguridad de la obra. Antes de ingresar entregará la lista de su personal con número de seguridad social y comprobante de alta, y sus constancias DC-3 cuando la actividad lo requiera; su personal portará identificación y equipo de protección personal en todo momento. EL CONTRATISTA podrá impedir el acceso a quien no cumpla y retirar de la obra a quien incurra en conductas inseguras.",
  ]});
  cl.push(C.seguros(h, "EL SUBCONTRATISTA"));
  cl.push({ t: "GARANTÍAS Y VICIOS OCULTOS", p: [
    `EL SUBCONTRATISTA entregará fianza de cumplimiento por el ${h.p("contrato.fianza_cumplimiento_pct")} del importe del subcontrato y, a la entrega, garantizará los trabajos contra vicios ocultos por ${h.v("contrato.vicios_meses")} meses mediante fianza por el ${h.p("contrato.fianza_vicios_pct")} o con el fondo de garantía retenido. Responderá de los defectos que procedan de vicios en su ejecución o en los materiales que haya suministrado, y los atenderá dentro de los diez días hábiles siguientes a su notificación.`,
  ]});
  cl.push(C.pena(h, "los trabajos no ejecutados conforme al programa", "EL SUBCONTRATISTA"));
  cl.push({ t: "DAÑOS Y PENALIZACIONES TRASLADADAS", p: [
    "Si por atraso o incumplimiento imputable a EL SUBCONTRATISTA el propietario de la obra aplica a EL CONTRATISTA penas, deductivas o cargos, EL SUBCONTRATISTA los reembolsará en la proporción que le sea imputable, previa demostración documental, hasta un máximo igual al importe de este subcontrato. Responderá igualmente por los daños que cause a los trabajos de terceros, a la obra o a los vecinos.",
  ]});
  cl.push({ t: "RECEPCIÓN Y FINIQUITO", p: [
    "Concluidos los trabajos y realizadas las pruebas, las partes harán un recorrido, levantarán la lista de pendientes y, atendida ésta, firmarán el acta de entrega-recepción. EL SUBCONTRATISTA entregará planos de obra terminada de su especialidad, memorias, garantías de fabricantes y manuales. El finiquito se formalizará dentro de los treinta días naturales siguientes.",
  ]});
  cl.push({ t: "SUBCONTRATACIÓN Y CESIÓN", p: [
    "EL SUBCONTRATISTA no podrá subcontratar a su vez ni ceder los trabajos sin autorización previa y por escrito de EL CONTRATISTA; si la obtiene, seguirá siendo responsable frente a EL CONTRATISTA y exigirá a su propio subcontratista el cumplimiento de la cláusula de REGISTRO REPSE.",
  ]});
  cl.push({ t: "RESCISIÓN Y TERMINACIÓN ANTICIPADA", p: [
    "EL CONTRATISTA podrá rescindir este contrato sin declaración judicial, mediante aviso por escrito, cuando EL SUBCONTRATISTA: pierda o no renueve su REPSE; no entregue la documentación laboral y fiscal por dos meses consecutivos; tenga un atraso mayor al 20 % respecto de su programa; incumpla las normas de seguridad de manera grave o reiterada; o incumpla cualquier otra obligación y no la subsane dentro de los cinco días hábiles siguientes a que se le requiera. En ese caso se pagarán los trabajos ejecutados y aceptados, se descontarán las penas y el sobrecosto de terminar los trabajos con terceros, y se reintegrará el anticipo no amortizado.",
    "Si el contrato principal se suspende o termina por causas ajenas a EL CONTRATISTA, éste podrá suspender o terminar el presente subcontrato pagando los trabajos ejecutados y los gastos no recuperables comprobados de EL SUBCONTRATISTA.",
  ]});
  cl.push(C.fuerzaMayor(), C.confidencialidad(), C.avisos(), C.integridad(), C.jurisdiccion());
  return {
    titulo: "CONTRATO DE OBRA ESPECIALIZADA (SUBCONTRATO) A PRECIOS UNITARIOS",
    archivo: "Subcontrato_Obra_Especializada",
    partes: [["EL CONTRATISTA", "empresa"], ["EL SUBCONTRATISTA", "contraparte"]],
    declaraciones: [
      declPersona(h, "empresa", "EL CONTRATISTA", [
        `Que es contratista general de la obra «${h.v("obra.nombre")}» en virtud del contrato principal ${h.v("subcontrato.contrato_principal")}, y requiere contratar trabajos especializados de ${minus(h.v("subcontrato.especialidad"))}, actividad que no forma parte de su objeto social ni de su actividad económica preponderante.`,
        `Que su registro patronal ante el IMSS es ${h.v("empresa.registro_patronal")}.`,
      ]),
      declPersona(h, "contraparte", "EL SUBCONTRATISTA", [
        `Que se dedica profesionalmente a ${minus(h.v("subcontrato.especialidad"))} y cuenta con personal calificado, herramienta, equipo y experiencia para ejecutar los trabajos.`,
        `Que es patrón con registro patronal ante el IMSS número ${h.v("contraparte.registro_patronal")} y cuenta con registro REPSE número ${h.v("contraparte.repse")}.`,
      ]),
      declConjunta(),
    ],
    clausulas: cl,
    anexos: ["A. Alcances, planos y especificaciones de la especialidad", "B. Catálogo de conceptos y precios unitarios", "C. Programa de los trabajos", "D. Reglamento de seguridad y acceso a la obra", "E. Constancia REPSE vigente, constancia de situación fiscal, opinión de cumplimiento SAT, IMSS e INFONAVIT"],
  };
}

// ---------- arrendamiento de maquinaria ----------
function arrendamiento(h) {
  const op = !!h.raw("arrendamiento.con_operador");
  const cl = [];
  cl.push({ t: "OBJETO", p: [
    `EL ARRENDADOR concede a EL ARRENDATARIO el uso y goce temporal de la maquinaria y equipo descritos en el Anexo A (en adelante, «el equipo»)${op ? ", junto con el servicio de su operación por personal de EL ARRENDADOR" : ", sin operador"}, para utilizarlo en la obra «${h.v("obra.nombre")}», ubicada en ${h.v("obra.ubicacion")}, ${h.v("obra.municipio")}, en términos de los artículos 2272 y 2333 y siguientes del Código Civil para el Estado de Baja California. El equipo no podrá trasladarse a otro sitio sin autorización por escrito de EL ARRENDADOR.`,
  ]});
  cl.push({ t: "RENTA", p: [
    "La renta de cada equipo será la tarifa indicada en el Anexo A, más IVA, con el mínimo de horas o jornadas ahí señalado. Las horas se medirán con el horómetro del equipo y se registrarán en el reporte diario de uso, que firmarán el operador o encargado de EL ARRENDADOR y el representante de EL ARRENDATARIO al final de cada jornada; el reporte firmado será la base de la facturación.",
    `No se cobrarán las horas en que el equipo no pueda trabajar por descompostura, falta de mantenimiento o causa imputable a EL ARRENDADOR. ${C.ivaTxt(h).replace(/^el /, "Se trasladará el ")}.`,
    `El flete de entrega y retiro del equipo tendrá un costo de ${h.m("arrendamiento.flete")} por movimiento, más IVA, a cargo de EL ARRENDATARIO.`,
  ]});
  cl.push({ t: "PAGO Y DEPÓSITO EN GARANTÍA", p: [
    `EL ARRENDADOR facturará ${perAdv(h)} con base en los reportes diarios firmados, y EL ARRENDATARIO pagará dentro de los ${h.v("contrato.dias_pago")} días naturales siguientes a la recepción del CFDI. EL ARRENDATARIO entrega en este acto un depósito en garantía de ${h.m("arrendamiento.deposito")}, que se le devolverá dentro de los diez días hábiles siguientes a la devolución del equipo, descontando en su caso los adeudos o daños imputables a él.`,
  ]});
  cl.push({ t: "PLAZO", p: [
    `El arrendamiento tendrá un plazo de ${h.v("arrendamiento.plazo")}, contado a partir de la entrega del equipo en la obra. Al vencer, podrá prorrogarse por escrito o por correo electrónico de ambas partes. Si EL ARRENDATARIO conserva el equipo después del vencimiento sin oposición de EL ARRENDADOR, el arrendamiento continuará en las mismas condiciones por periodos iguales.`,
  ]});
  cl.push({ t: "ENTREGA Y DEVOLUCIÓN", p: [
    "El equipo se entregará y devolverá con acta de entrega que haga constar su estado, accesorios, lectura del horómetro, nivel de combustible y reporte fotográfico. EL ARRENDATARIO lo devolverá en el estado en que lo recibió, salvo el desgaste por el uso normal. Las diferencias de combustible y los daños distintos del desgaste normal se cobrarán a precio comprobado.",
  ]});
  cl.push({ t: "MANTENIMIENTO, COMBUSTIBLE Y FALLAS", p: [
    `El mantenimiento preventivo y correctivo del equipo será a cargo de EL ARRENDADOR, quien lo realizará fuera del horario de trabajo o, si no es posible, en el menor tiempo. El combustible será a cargo de ${h.v("arrendamiento.combustible_a_cargo")}; los lubricantes, filtros y refacciones por desgaste normal, a cargo de EL ARRENDADOR.`,
    "Si el equipo falla, EL ARRENDADOR lo reparará o sustituirá por uno equivalente dentro de las veinticuatro horas siguientes al aviso. Si no lo hace, EL ARRENDATARIO podrá rentar un equipo sustituto con tercero y descontar a EL ARRENDADOR la diferencia de precio comprobada, o dar por terminado el arrendamiento de ese equipo sin responsabilidad.",
  ]});
  if (op) {
    cl.push({ t: "OPERADOR", p: [
      "El equipo será operado exclusivamente por operadores de EL ARRENDADOR, calificados y con constancia de habilidades vigente para el equipo. El operador estará bajo la dirección y dependencia de EL ARRENDADOR, quien es su único patrón; EL ARRENDATARIO sólo le indicará los trabajos por realizar y el frente de trabajo.",
      `EL ARRENDADOR declara su registro patronal ante el IMSS número ${h.v("contraparte.registro_patronal")} y, en caso de que la renta con operador constituya un servicio especializado, su registro REPSE número ${h.v("contraparte.repse")}. Entregará mensualmente los comprobantes de nómina y de pago de cuotas del operador y la documentación del artículo 27, fracción V, de la Ley del Impuesto sobre la Renta. Si la autoridad fiscal determina que procede la retención de IVA prevista en el artículo 1-A, fracción IV, de la Ley del IVA, EL ARRENDATARIO la aplicará. Le son aplicables, en lo conducente, las obligaciones de la cláusula de RELACIONES LABORALES Y SEGURIDAD SOCIAL.`,
      "La jornada del operador se sujetará a los límites legales. El tiempo extraordinario que EL ARRENDATARIO solicite se pagará conforme a la tarifa del Anexo A. Las horas en que el equipo y el operador estén disponibles en la obra pero sin trabajar por causas imputables a EL ARRENDATARIO (falta de frente, de instrucciones o de acceso) se pagarán como horas de espera al 50 % de la tarifa, siempre que se asienten en el reporte diario.",
    ]});
    cl.push(C.laboral(h, "EL ARRENDADOR"));
  } else {
    cl.push({ t: "OPERACIÓN POR EL ARRENDATARIO", p: [
      "EL ARRENDATARIO operará el equipo con personal propio, calificado y con constancia de habilidades vigente, conforme a los manuales del fabricante y a la NOM-031-STPS-2011, y será responsable de su uso. EL ARRENDADOR dará la capacitación básica de operación al momento de la entrega.",
    ]});
  }
  cl.push({ t: "USO Y CUIDADO", p: [
    "EL ARRENDATARIO usará el equipo sólo para el fin y en el sitio pactados, conforme a su capacidad y a las indicaciones del fabricante; no lo subarrendará, cederá ni gravará, ni permitirá que se embargue por deudas propias; lo resguardará al término de cada jornada en un lugar seguro dentro de la obra; y dará aviso inmediato de cualquier falla, accidente o siniestro. EL ARRENDADOR podrá inspeccionar el equipo en horario de trabajo, previo aviso.",
  ]});
  cl.push({ t: "SEGUROS, ROBO Y SINIESTROS", p: [
    `El equipo contará con seguro a cargo de EL ARRENDADOR que cubra daños materiales, robo y responsabilidad civil. Mientras el equipo esté bajo custodia de EL ARRENDATARIO, éste responderá de su pérdida o daño por causas que le sean imputables, incluida la falta de resguardo. En caso de siniestro imputable a EL ARRENDATARIO, éste cubrirá el deducible y la renta del tiempo que el equipo esté fuera de servicio, con un máximo de treinta días. ${op ? "Los daños causados a terceros o a la obra por la operación del equipo serán responsabilidad de EL ARRENDADOR, salvo que deriven de instrucciones inseguras de EL ARRENDATARIO." : "Los daños causados a terceros o a la obra por la operación del equipo serán responsabilidad de EL ARRENDATARIO."}`,
  ]});
  cl.push({ t: "TERMINACIÓN ANTICIPADA Y RESCISIÓN", p: [
    "EL ARRENDATARIO podrá devolver uno o varios equipos antes del vencimiento, pagando la renta devengada, el mínimo pactado del periodo en curso y el flete de retiro. Cualquiera de las partes podrá rescindir el contrato sin declaración judicial en caso de incumplimiento grave de la otra que no se subsane dentro de los tres días hábiles siguientes a que se le requiera por escrito. La falta de pago por más de quince días naturales autoriza a EL ARRENDADOR a retirar el equipo, previo aviso por escrito con dos días hábiles de anticipación.",
  ]});
  cl.push(C.fuerzaMayor(true), C.avisos(false), C.integridad("el presente contrato, el Anexo A y las actas de entrega y devolución"), C.jurisdiccion());
  return {
    titulo: `CONTRATO DE ARRENDAMIENTO DE MAQUINARIA Y EQUIPO ${op ? "CON OPERADOR" : "SIN OPERADOR"}`,
    archivo: "Contrato_Arrendamiento_Maquinaria",
    partes: [["EL ARRENDADOR", "contraparte"], ["EL ARRENDATARIO", "empresa"]],
    declaraciones: [
      declPersona(h, "contraparte", "EL ARRENDADOR", [
        "Que es legítimo propietario del equipo descrito en el Anexo A, o que tiene facultades para darlo en arrendamiento, y que el equipo se encuentra en buen estado de funcionamiento, con sus mantenimientos al corriente y libre de gravámenes que impidan su uso.",
      ]),
      declPersona(h, "empresa", "EL ARRENDATARIO", [
        `Que requiere el equipo para ejecutar la obra «${h.v("obra.nombre")}».`,
      ]),
      declConjunta(),
    ],
    clausulas: cl,
    tablaEquipos: true,
    anexos: ["A. Relación de equipos, tarifas y mínimos (incluida en este contrato)", "B. Actas de entrega y devolución con reporte fotográfico", "C. Formato de reporte diario de uso de equipo", "D. Pólizas de seguro del equipo" + (op ? " y constancias del operador" : "")],
  };
}

module.exports = { ORD, contratos: {
  precio_alzado: h => contratoObra(h, "precio_alzado"),
  precios_unitarios: h => contratoObra(h, "precios_unitarios"),
  subcontrato,
  arrendamiento,
}};
