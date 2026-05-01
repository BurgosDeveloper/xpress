import type { ServiceType } from "../rides/rides.types";

export function serviceTypeLabel(t: ServiceType) {
  switch (t) {
    case "CARRO":
      return "Carro";
    case "MOTO":
      return "Moto";
    case "MOTO_CARGA":
      return "Moto carga";
    case "CARRO_CARGA":
      return "Carro carga";
  }
}

export function serviceTypeHasCargo(t: ServiceType) {
  return t === "MOTO_CARGA" || t === "CARRO_CARGA";
}

export function serviceTypeIconName(t: ServiceType): "car-outline" | "bicycle-outline" | "car-sport-outline" {
  switch (t) {
    case "CARRO":
      return "car-outline";
    case "MOTO":
      return "bicycle-outline";
    case "MOTO_CARGA":
      return "bicycle-outline";
    case "CARRO_CARGA":
      return "car-sport-outline";
  }
}
