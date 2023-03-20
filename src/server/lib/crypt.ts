import bcrypt from 'bcrypt'

export async function checkPassword(cryptedPassword: string, password: string): Promise<boolean> {
  // const psw = bcrypt.hashSync(password, 10)
  // console.log('psw', psw);
  return await bcrypt.compare(password, cryptedPassword)
}

export function cryptPassword(str: string): string {
  return bcrypt.hashSync(str, 10)
}