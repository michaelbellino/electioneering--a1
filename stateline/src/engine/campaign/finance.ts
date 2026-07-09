/**
 * Campaign finance — an integer-cents ledger. Money is never a float; every spend/raise keeps the
 * invariant cash === totalRaised − totalSpent (plus any starting cash booked as raised).
 */
import type { Cents } from '../core/primitives'
import type { FinanceState } from './types'

export function createFinance(startingCash: Cents = 0): FinanceState {
  return { cash: startingCash, totalRaised: startingCash, totalSpent: 0 }
}

export function canAfford(finance: FinanceState, cents: Cents): boolean {
  return finance.cash >= cents
}

export function spend(finance: FinanceState, cents: Cents): FinanceState {
  return { ...finance, cash: finance.cash - cents, totalSpent: finance.totalSpent + cents }
}

export function raise(finance: FinanceState, cents: Cents): FinanceState {
  return { ...finance, cash: finance.cash + cents, totalRaised: finance.totalRaised + cents }
}

/** Invariant check used in tests: cash equals everything raised minus everything spent. */
export function financeBalances(finance: FinanceState): boolean {
  return finance.cash === finance.totalRaised - finance.totalSpent
}
