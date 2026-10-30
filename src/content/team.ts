// Socios y equipo de Deluca & Fernández Moores

export interface Partner {
  name: string;
  field: string;
}

export interface TeamProfile {
  name: string;
  summary: string;
}

export interface SocioData {
  name: string;
  role: string;
  degrees: string;
  summary: string;
  specialties: string[];
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;
  photoKey: 'deluca' | 'fernandezMoores';
}

export const team = {
  title: ['Socios fundadores'] as [string],
  socios: [
    {
      name: 'Dr. Santiago Deluca',
      role: 'Socio Fundador',
      degrees: 'Doctor en Derecho (URJC, España) · Abogado (UBA) · Árbitro Suplente TPR MERCOSUR',
      summary: 'Egresado de la Universidad de Buenos Aires (UBA) y Doctor en Derecho por la Universidad Rey Juan Carlos (URJC, Madrid, España). Es profesor e investigador en UBA, Universidad del Salvador (USAL) y UCES. Desempeña el cargo de Árbitro Suplente del Tribunal Permanente de Revisión del MERCOSUR (TPR). Especialista en derecho económico internacional, compliance integral, derecho aduanero, defensa de la competencia y arbitrajes internacionales.',
      specialties: ['Derecho Económico Internacional', 'Compliance Corporativo & Penal', 'Arbitraje Nacional e Internacional', 'Derecho Aduanero & Antidumping'],
      email: 'deluca.santiago@gmail.com',
      phone: '+54 9 11 6407-3969',
      whatsapp: 'https://wa.me/5491164073969?text=Hola%2C%20quisiera%20realizar%20una%20consulta%20legal',
      linkedin: 'https://www.linkedin.com/in/santiago-deluca-0a8512159/',
      photoKey: 'deluca',
    },
    {
      name: 'Dr. Gonzalo Fernández Moores',
      role: 'Socio Fundador',
      degrees: 'Abogado (UAI) · Especialista en Litigios Complejos y Derecho Societario',
      summary: 'Egresado de la Universidad Abierta Interamericana (UAI). Especialista en derecho societario y corporativo, contratos comerciales de alta complejidad, litigios civiles y comerciales estratégicos, derecho inmobiliario y amparos de salud ante obras sociales y prepagas. Asesora y representa a empresas nacionales y multinacionales en negociaciones complejas y resolución judicial de controversias.',
      specialties: ['Derecho Societario & Comercial', 'Litigios Civiles & Comerciales Complejos', 'Derecho a la Salud y Medidas Cautelares', 'Contratos y Negociaciones Comerciales'],
      email: 'gonzalofmoores@gmail.com',
      phone: '+54 9 11 5339-6530',
      whatsapp: 'https://wa.me/5491153396530?text=Hola%2C%20quisiera%20realizar%20una%20consulta%20legal',
      linkedin: 'https://www.linkedin.com/in/gonzalo-fern%C3%A1ndez-moores-348790159/',
      photoKey: 'fernandezMoores',
    },
  ] as SocioData[],
  partners: [
    { name: 'Dr. Santiago Deluca', field: 'Doctor en Derecho (URJC), Abogado (UBA). Especialista en derecho económico internacional y arbitrajes.' },
    { name: 'Dr. Gonzalo Fernández Moores', field: 'Abogado (UAI). Especialista en derecho societario, litigios complejos y derecho a la salud.' },
  ] as Partner[],
  profiles: [
    {
      name: 'Dr. Santiago Deluca',
      summary: 'Egresado de Derecho por la Universidad de Buenos Aires (UBA) y Doctor en Derecho por la Universidad Rey Juan Carlos (URJC, Madrid, España). Profesor e investigador en UBA, Universidad del Salvador (USAL) y Universidad de Ciencias Empresariales y Sociales (UCES). Especialista en derecho económico internacional, compliance, derecho penal económico, derecho aduanero y arbitrajes. Árbitro Suplente del Tribunal Permanente de Revisión del MERCOSUR (TPR).',
    },
    {
      name: 'Dr. Gonzalo Fernández Moores',
      summary: 'Egresado de Derecho por la Universidad Abierta Interamericana (UAI). Especialista en derecho societario, contratos comerciales nacionales e internacionales, litigios civiles y comerciales complejos, derecho inmobiliario y amparos de salud. Asesora a clientes locales y extranjeros en resolución de controversias y estructuración legal de negocios.',
    },
  ] as TeamProfile[],
};
