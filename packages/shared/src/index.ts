export type CurrencyCode = string;

export interface Money {
  readonly amountCents: number;
  readonly currency: CurrencyCode;
}
