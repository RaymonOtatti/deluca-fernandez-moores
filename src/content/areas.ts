// Áreas de práctica de Deluca & Fernández Moores
// Fuente oficial: https://delucafmoores.com.ar/areas-de-practica-del-derecho-abogados-en-buenos-aires-argentina/

export interface AreaGroup {
  id: string;
  title: string;
  items: string[];
}

export const areas = {
  title: ['Áreas de práctica'] as [string],
  text: 'Brindamos cobertura legal estratégica en las cinco disciplinas fundamentales del derecho en Argentina y el exterior.',
  groups: [
    {
      id: 'derecho-civil',
      title: 'Derecho Civil',
      items: [
        'Derecho Inmobiliario (locaciones, desalojos y compraventa)',
        'Sucesiones y planificación patrimonial',
        'Ejecuciones hipotecarias y comerciales',
        'Derecho de Familia',
        'Determinación de Capacidad',
        'Contratos Civiles',
        'Litigios en General',
        'Amparos de Salud (cobertura médica y tratamientos)',
      ],
    },
    {
      id: 'derecho-comercial',
      title: 'Derecho Comercial',
      items: [
        'Derecho societario y empresarial',
        'Contratos comerciales nacionales e internacionales',
        'Real estate y desarrollos inmobiliarios',
        'Fideicomisos de administración y garantía',
        'Ejecuciones comerciales',
        'Concursos preventivos y quiebras',
        'Arbitraje comercial',
        'Defensa del consumidor',
        'Litigios comerciales de alta complejidad',
      ],
    },
    {
      id: 'derecho-internacional',
      title: 'Derecho Internacional',
      items: [
        'Project Finance y estructuración de negocios',
        'Procesos antidumping y medidas compensatorias',
        'Lealtad comercial y defensa de la competencia',
        'Arbitraje internacional',
        'Compliance empresarial, comercial y penal',
        'Contratos comerciales internacionales',
        'Soporte transfronterizo con Brasil (BPP Abogados)',
      ],
    },
    {
      id: 'derecho-aduanero',
      title: 'Derecho Aduanero',
      items: [
        'Reconocimiento de origen de mercaderías',
        'Procesos litigiosos aduaneros',
        'Impugnación y repetición de tributos',
        'Clasificación arancelaria y valoración aduanera',
        'Sumarios contenciosos y régimen infraccional',
      ],
    },
    {
      id: 'derecho-penal',
      title: 'Derecho Penal',
      items: [
        'Procesos de extradición internacional',
        'Derecho penal económico',
        'Derecho penal tributario y cambiario',
        'Defensa y querellas en delitos patrimoniales',
        'Compliance y prevención de responsabilidad penal empresarial',
      ],
    },
  ] as AreaGroup[],
};
