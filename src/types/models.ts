export type Brand = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: number;
  brandId: number;
  brandName: string;
  typeName: string;
  name: string;
  size: string;
  pattern: string;
  qty: number;
  createdAt: string;
  updatedAt: string;
};

export type ShipmentItem = {
  productId: number;
  qty: number;
};

export type ShipmentStatus = 'ordered' | 'on_delivery' | 'arrived' | 'done';

export type Shipment = {
  id: number;
  containerNumber: string;
  etd: string;
  eta: string;
  forwarder: string;
  supplier: string;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    productId: number;
    productName: string;
    qty: number;
  }>;
};
