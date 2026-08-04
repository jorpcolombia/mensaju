import mongoose from "mongoose";

let connectPromise: Promise<typeof mongoose> | null = null;

export function connectDb(uri: string): Promise<typeof mongoose> {
  if (!connectPromise) {
    connectPromise = mongoose.connect(uri);
  }
  return connectPromise;
}
