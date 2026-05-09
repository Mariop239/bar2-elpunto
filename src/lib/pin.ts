import bcrypt from "bcryptjs";

export const hashPin = (pin: string) => bcrypt.hashSync(pin, 10);
export const comparePin = (pin: string, hash: string) =>
  bcrypt.compareSync(pin, hash);

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin);
