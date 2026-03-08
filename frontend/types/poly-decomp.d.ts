declare module 'poly-decomp' {
  function decomp(poly: number[][]): number[][][]
  function quickDecomp(poly: number[][], result?: number[][][], reflexVertices?: number[][], steinerPoints?: number[][], delta?: number, maxlevel?: number, level?: number): number[][][]
  function isSimple(path: number[][]): boolean
  function removeCollinearPoints(poly: number[][], thresholdAngle?: number): void
  function removeDuplicatePoints(poly: number[][], precision?: number): void
  function makeCCW(poly: number[][]): boolean
}
