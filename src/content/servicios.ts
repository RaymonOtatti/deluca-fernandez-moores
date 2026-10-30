// Servicios legales de Deluca & Fernández Moores
// Fuente oficial: https://delucafmoores.com.ar/servicios-legales/

export interface ServicioItem {
  id: string;
  title: string;
  description: string;
}

export const servicios = {
  title: ['Servicios legales'] as [string],
  lead: 'Acompañamiento jurídico personalizado en instancias preventivas, contractuales, extrajudiciales, administrativas y judiciales.',
  items: [
    {
      id: 'asesoramiento-integral',
      title: 'Asesoramiento legal integral',
      description:
        'Gestión y desarrollo de reuniones presenciales y virtuales para evacuar en forma personalizada consultas de nuestros clientes, así como de personas o empresas interesadas en nuestros servicios.',
    },
    {
      id: 'cobranza-extrajudicial',
      title: 'Gestión de cobranza extra-judicial',
      description:
        'Entre otras herramientas, desplegamos labores de intimación, mediaciones, negociaciones y arbitrajes.',
    },
    {
      id: 'contratos',
      title: 'Redacción y revisión de contratos nacionales e internacionales',
      description:
        'Incluye contratos de prestación de servicios, adhesión, locación, autorización para uso de espacio, compraventa, franchising, leasing, representación, distribución, transporte, cooperación, convenios de confidencialidad, audiovisuales, publicidad, etc.',
    },
    {
      id: 'compliance',
      title: 'Asesoramiento en compliance',
      description:
        'Elaboración de programas de integridad, realización de auditorías. Generación de diagnósticos, evaluaciones de riesgos, proyección de programas integrales de cumplimiento con presentación de códigos de conducta, sistema de canalización de denuncias y diagramación de plan de capacitación.',
    },
    {
      id: 'reparticiones-administrativas',
      title: 'Actuación ante reparticiones administrativas',
      description:
        'Asesoramiento legal y gestión en expedientes iniciados ante las diversas dependencias administrativas nacionales, provinciales y de la Ciudad Autónoma de Buenos Aires.',
    },
    {
      id: 'actuacion-judicial',
      title: 'Actuación judicial',
      description:
        'Representación judicial en todas las instancias ante tribunales nacionales, federales, de la provincia de Buenos Aires y de la Ciudad Autónoma de Buenos Aires.',
    },
  ] as ServicioItem[],
};
