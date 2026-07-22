export type BusinessRecord = {
  id: string;
  name: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};
export type BusinessRecordList = { items: BusinessRecord[]; total: number };
