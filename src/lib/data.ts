export interface ImageData {
  id: string;
  src: string;
  alt: string;
  tags: string[];
  date: string;
  category: string;
  hint: string;
}

export interface District {
  id: string;
  name: string;
  images: ImageData[];
}

export interface Department {
  id: string;
  name: string;
  districts: District[];
}

export const initialDepartments: Department[] = [
  {
    id: 'd1',
    name: 'Asunción (Capital)',
    districts: [
      {
        id: 'd1-dist1',
        name: 'La Catedral',
        images: [
          {
            id: 'img1',
            src: 'https://picsum.photos/seed/bldg1/600/400',
            alt: 'Edificio electoral en La Catedral',
            tags: ['exterior', 'fachada', 'gobierno'],
            date: '2023-10-15',
            category: 'Fachada',
            hint: 'building facade',
          },
        ],
      },
      { id: 'd1-dist2', name: 'San Roque', images: [] },
    ],
  },
  {
    id: 'd2',
    name: 'Alto Paraná',
    districts: [
      {
        id: 'd2-dist1',
        name: 'Ciudad del Este',
        images: [
          {
            id: 'img2',
            src: 'https://picsum.photos/seed/bldg2/600/400',
            alt: 'Oficina de registros en Ciudad del Este',
            tags: ['oficina', 'interior', 'escritorios'],
            date: '2023-11-02',
            category: 'Interior',
            hint: 'office building',
          },
          {
            id: 'img3',
            src: 'https://picsum.photos/seed/int1/600/400',
            alt: 'Sala de espera',
            tags: ['sala', 'sillas', 'ventana'],
            date: '2023-11-02',
            category: 'Interior',
            hint: 'office interior',
          },
        ],
      },
      { id: 'd2-dist2', name: 'Presidente Franco', images: [] },
      { id: 'd2-dist3', name: 'Minga Guazú', images: [] },
    ],
  },
  {
    id: 'd3',
    name: 'Central',
    districts: [
      { id: 'd3-dist1', name: 'Luque', images: [] },
      { id: 'd3-dist2', name: 'San Lorenzo', images: [] },
      {
        id: 'd3-dist3',
        name: 'Capiatá',
        images: [
          {
            id: 'img4',
            src: 'https://picsum.photos/seed/bldg3/600/400',
            alt: 'Centro de votación en Capiatá',
            tags: ['edificio', 'entrada', 'accesibilidad'],
            date: '2024-01-20',
            category: 'Exterior',
            hint: 'building entrance',
          },
        ],
      },
      { id: 'd3-dist4', name: 'Lambaré', images: [] },
    ],
  },
  {
    id: 'd4',
    name: 'Itapúa',
    districts: [
      {
        id: 'd4-dist1',
        name: 'Encarnación',
        images: [
          {
            id: 'img5',
            src: 'https://picsum.photos/seed/int2/600/400',
            alt: 'Pasillo de la oficina de registros',
            tags: ['pasillo', 'iluminación', 'oficina'],
            date: '2024-02-18',
            category: 'Infraestructura',
            hint: 'building hallway',
          },
        ],
      },
      { id: 'd4-dist2', name: 'Coronel Bogado', images: [] },
    ],
  },
];
