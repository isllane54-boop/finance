export interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: 'income' | 'variable_income' | 'fixed_expense' | 'variable_expense';
  category: string;
  date: string;
  is_recurring: boolean;
  installments?: number;
  start_date?: string;
}

export interface Investment {
  id: number;
  name: string;
  amount: number;
  type: string;
  expected_return: number;
  date: string;
}

export interface Summary {
  income: number;
  variable_income: number;
  fixed: number;
  variable: number;
  invested: number;
}
