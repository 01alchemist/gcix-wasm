
class Data {
  constructor() { }
}

export function size(): u32 {
  return sizeof<Data>()
}
export function ptr(): u32 {
  const d = new Data()
  return changetype<usize>(d)
}
