import jwt from "jsonwebtoken";
import { required } from "../env.js";

const TOKEN_TTL = "30d";

export function issueCustomerToken(customerId: string): string {
  return jwt.sign({ sub: customerId, typ: "customer" }, required("CUSTOMER_JWT_SECRET"), {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyCustomerToken(token: string): string {
  const payload = jwt.verify(token, required("CUSTOMER_JWT_SECRET")) as {
    sub: string;
    typ: string;
  };
  if (payload.typ !== "customer") {
    throw new Error("Not a customer token");
  }
  return payload.sub;
}
