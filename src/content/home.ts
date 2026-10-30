// Deluca & Fernández Moores - Home page copy

export interface Fact {
  label: string;
  value: string;
  caption: string;
}

export interface StoryPart {
  title: string;
  text: string;
}

export const estudio = {
  title: ['Soluciones legales estratégicas'] as [string],
  text: [
    'Gonzalo Fernández Moores y Santiago Deluca conjugamos experiencia y trayectoria en el campo del derecho.',
    'Formamos un grupo humano con el impulso y la energía de nuestra generación, brindando asesoramiento y representación legal a clientes de Argentina y el exterior.',
  ],
  facts: [
    { label: 'Sede Central', value: 'C.A.B.A.', caption: 'Pasaje Carabelas 241, 4° Piso, Buenos Aires.' },
    { label: 'Especialidades', value: '+10', caption: 'Áreas de práctica del derecho civil, comercial e internacional.' },
    { label: 'Alianzas', value: 'BPP / Brasil', caption: 'Socios argentinos de Barral Parente Pinheiro Abogados.' },
  ] as Fact[],
  story: [
    {
      title: 'Trayectoria e Impulso',
      text: 'Gonzalo Fernández Moores y Santiago Deluca unimos nuestros perfiles profesionales para combinar sólida trayectoria jurídica con dinamismo e innovación. Comprendemos la dinámica contemporánea de los negocios para estructurar soluciones ágiles y eficaces que satisfacen las exigencias de clientes corporativos y particulares.',
    },
    {
      title: 'Visión Interdisciplinaria',
      text: 'Trabajamos en forma interdisciplinaria e integrada con profesionales de distintos ámbitos técnicos, financieros y periciales. Esta perspectiva nos permite desplegar una visión amplia y dotar de máxima solidez y prevención a las estrategias legales y acuerdos contractuales que diseñamos.',
    },
    {
      title: 'Alcance Nacional e Internacional',
      text: 'Brindamos cobertura integral en derecho societario, compliance, litigios civiles y comerciales, derecho a la salud, penal económico, aduanero y arbitrajes. Además, como socios de Barral Parente Pinheiro Abogados (Brasilia y San Pablo), ofrecemos soporte legal binacional para operaciones transfronterizas.',
    },
  ] as StoryPart[],
};

