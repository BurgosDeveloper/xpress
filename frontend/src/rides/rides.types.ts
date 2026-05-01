export type ServiceType = "CARRO" | "MOTO" | "MOTO_CARGA" | "CARRO_CARGA";

export type NearbyDriver = {
  driverId: string;
  fullName: string;
  photoUrl: string | null;
  serviceType: ServiceType;
  vehicle: null | {
    brand: string;
    model: string;
    year: number;
    color: string;
    hasAC: boolean;
  };
  location: null | {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  distanceMeters: number;
};

export type NearbyDriversResponse = {
  ok: true;
  center: { lat: number; lng: number };
  radiusM: number;
  items: NearbyDriver[];
};

export type CreateRideResponse = {
  ok: true;
  ride: { id: string } & Record<string, unknown>;
};

export type SelectDriverResponse = {
  ok: true;
  ride: { id: string; status: string } & Record<string, unknown>;
};

export type DriverTechSheet = {
  id: string;
  fullName: string;
  phone: string | null;
  photoUrl: string | null;
  serviceType: ServiceType;
  vehicle: null | {
    brand: string;
    model: string;
    plate: string | null;
    year: number;
    color: string;
    doors: number | null;
    hasAC: boolean;
    hasTrunk: boolean;
    allowsPets: boolean;
  };
  documents: Array<{ type: "VEHICLE_PHOTO"; url: string }>;
};

export type DriverTechSheetResponse = {
  ok: true;
  driver: DriverTechSheet;
};
