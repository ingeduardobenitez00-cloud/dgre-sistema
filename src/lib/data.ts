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

export const initialDepartments: Department[] = [];
