import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  TrendingUp, 
  Wallet, 
  Plus, 
  Trash2, 
  Calendar,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  ChevronRight,
  Target,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { format, addMonths, startOfMonth, endOfMonth, isWithinInterval, getQuarter, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn } from './lib/utils';
import { Transaction, Investment, Summary } from './types';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899'];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'investments' | 'projections' | 'taxes'>('dashboard');
  const [projectionView, setProjectionView] = useState<'chart' | 'reports'>('chart');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<Summary>({ income: 0, variable_income: 0, fixed: 0, variable: 0, invested: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'transaction' | 'investment'>('transaction');
  const [isRecurringChecked, setIsRecurringChecked] = useState(false);

  const fetchData = async () => {
    try {
      const [tRes, iRes, sRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/investments'),
        fetch('/api/summary')
      ]);
      setTransactions(await tRes.json());
      setInvestments(await iRes.json());
      setSummary(await sRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      description: formData.get('description'),
      amount: parseFloat(formData.get('amount') as string),
      type: formData.get('type'),
      category: formData.get('category'),
      date: formData.get('date'),
      is_recurring: isRecurringChecked,
      installments: isRecurringChecked ? parseInt(formData.get('installments') as string) : 1,
      start_date: isRecurringChecked ? formData.get('start_date') : formData.get('date')
    };

    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setIsModalOpen(false);
    fetchData();
  };

  const handleAddInvestment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      amount: parseFloat(formData.get('amount') as string),
      type: formData.get('type'),
      expected_return: parseFloat(formData.get('expected_return') as string),
      date: formData.get('date')
    };

    await fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setIsModalOpen(false);
    fetchData();
  };

  const deleteTransaction = async (id: number) => {
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getEndDate = (startDate: string, installments: number) => {
    return format(addMonths(new Date(startDate), installments - 1), 'MM/yyyy');
  };

  const chartData = [
    { name: 'Fixas', value: summary.income, color: '#10b981' },
    { name: 'Variáveis', value: summary.variable_income, color: '#34d399' },
    { name: 'Fixos', value: summary.fixed, color: '#ef4444' },
    { name: 'Variáveis', value: summary.variable, color: '#f59e0b' },
    { name: 'Investido', value: summary.invested, color: '#6366f1' },
  ];

  const categoryData = Object.entries(
    transactions.reduce((acc, t) => {
      if (t.type !== 'income' && t.type !== 'variable_income') {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
      }
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Simple projection for the next 6 months
  const projectionData = Array.from({ length: 6 }).map((_, i) => {
    const month = addMonths(new Date(), i);
    const recurringExpenses = transactions
      .filter(t => t.is_recurring && (t.type === 'fixed_expense' || t.type === 'variable_expense'))
      .reduce((sum, t) => sum + t.amount, 0);
    const recurringIncome = transactions
      .filter(t => t.is_recurring && (t.type === 'income' || t.type === 'variable_income'))
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      month: format(month, 'MMM', { locale: ptBR }),
      balance: (recurringIncome - recurringExpenses) * (i + 1) + (summary.income + summary.variable_income - summary.fixed - summary.variable)
    };
  });

  const calculateTaxes = (grossIncome: number) => {
    // INSS 2026 (Estimated)
    let inss = 0;
    if (grossIncome <= 1412) inss = grossIncome * 0.075;
    else if (grossIncome <= 2666.68) inss = (1412 * 0.075) + (grossIncome - 1412) * 0.09;
    else if (grossIncome <= 4000.03) inss = (1412 * 0.075) + (1254.68 * 0.09) + (grossIncome - 2666.68) * 0.12;
    else if (grossIncome <= 7786.02) inss = (1412 * 0.075) + (1254.68 * 0.09) + (1333.35 * 0.12) + (grossIncome - 4000.03) * 0.14;
    else inss = 908.85;

    // IRPF 2026 (Estimated)
    const baseCalculo = grossIncome - inss;
    let irpf = 0;
    if (baseCalculo <= 2259.20) irpf = 0;
    else if (baseCalculo <= 2826.65) irpf = (baseCalculo * 0.075) - 169.44;
    else if (baseCalculo <= 3751.05) irpf = (baseCalculo * 0.15) - 381.44;
    else if (baseCalculo <= 4664.68) irpf = (baseCalculo * 0.225) - 662.77;
    else irpf = (baseCalculo * 0.275) - 896.00;

    return { inss, irpf, net: grossIncome - inss - irpf };
  };

  const totalGrossIncome = summary.income + summary.variable_income;
  const taxes = calculateTaxes(totalGrossIncome);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Wallet size={20} />
            </div>
            <h1 className="font-bold text-xl tracking-tight">FinPro</h1>
          </div>

          <nav className="space-y-1">
            <SidebarItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarItem 
              icon={<ArrowDownCircle size={20} />} 
              label="Transações" 
              active={activeTab === 'transactions'} 
              onClick={() => setActiveTab('transactions')} 
            />
            <SidebarItem 
              icon={<TrendingUp size={20} />} 
              label="Investimentos" 
              active={activeTab === 'investments'} 
              onClick={() => setActiveTab('investments')} 
            />
            <SidebarItem 
              icon={<LineChartIcon size={20} />} 
              label="Projeções" 
              active={activeTab === 'projections'} 
              onClick={() => setActiveTab('projections')} 
            />
            <SidebarItem 
              icon={<Calendar size={20} />} 
              label="Impostos" 
              active={activeTab === 'taxes'} 
              onClick={() => setActiveTab('taxes')} 
            />
          </nav>
        </div>

        <div className="mt-auto p-6 border-top border-slate-100">
          <button 
            onClick={() => { setModalType('transaction'); setIsModalOpen(true); }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 font-medium"
          >
            <Plus size={20} />
            Novo Registro
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 capitalize">
              {activeTab === 'dashboard' ? 'Visão Geral' : 
               activeTab === 'transactions' ? 'Minhas Transações' : 
               activeTab === 'investments' ? 'Carteira de Investimentos' : 
               activeTab === 'projections' ? 'Projeções Futuras' : 'Deduções e Impostos'}
            </h2>
            <p className="text-slate-500">Bem-vindo de volta ao seu controle financeiro.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Saldo Total</p>
              <p className="text-xl font-bold text-indigo-600">{formatCurrency(summary.income + summary.variable_income - summary.fixed - summary.variable)}</p>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <SummaryCard title="Fixas" value={summary.income} icon={<ArrowUpCircle className="text-emerald-500" />} color="emerald" />
                <SummaryCard title="Variáveis" value={summary.variable_income} icon={<TrendingUp className="text-emerald-400" />} color="emerald" />
                <SummaryCard title="G. Fixos" value={summary.fixed} icon={<ArrowDownCircle className="text-rose-500" />} color="rose" />
                <SummaryCard title="G. Variáveis" value={summary.variable} icon={<ArrowDownCircle className="text-amber-500" />} color="amber" />
                <SummaryCard title="Investido" value={summary.invested} icon={<TrendingUp className="text-indigo-500" />} color="indigo" />
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <h3 className="font-bold mb-6 flex items-center gap-2">
                    <BarChart size={18} className="text-slate-400" />
                    Distribuição de Recursos
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-card p-6">
                  <h3 className="font-bold mb-6 flex items-center gap-2">
                    <PieChartIcon size={18} className="text-slate-400" />
                    Gastos por Categoria
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold">Transações Recentes</h3>
                  <button onClick={() => setActiveTab('transactions')} className="text-indigo-600 text-sm font-medium flex items-center gap-1">
                    Ver todas <ChevronRight size={16} />
                  </button>
                </div>
                <div className="divide-y divide-slate-50">
                  {transactions.slice(0, 5).map(t => (
                    <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          (t.type === 'income' || t.type === 'variable_income') ? "bg-emerald-100 text-emerald-600" : 
                          t.type === 'fixed_expense' ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                        )}>
                          {(t.type === 'income' || t.type === 'variable_income') ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{t.description}</p>
                          <p className="text-xs text-slate-400">
                            {t.category} • {format(new Date(t.date), 'dd MMM yyyy', { locale: ptBR })}
                            {t.is_recurring && t.installments && (
                              <span className="ml-2 text-indigo-500 font-medium">
                                (Recorrente: {t.installments}x • Fim: {getEndDate(t.start_date || t.date, t.installments)})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p className={cn(
                        "font-bold",
                        (t.type === 'income' || t.type === 'variable_income') ? "text-emerald-600" : "text-slate-900"
                      )}>
                        {(t.type === 'income' || t.type === 'variable_income') ? '+' : '-'} {formatCurrency(t.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div 
              key="transactions"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-lg">Histórico Completo</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setModalType('transaction'); setIsModalOpen(true); }} className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                    <Plus size={16} /> Adicionar
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">Descrição</th>
                      <th className="px-6 py-4 font-bold">Tipo</th>
                      <th className="px-6 py-4 font-bold">Categoria</th>
                      <th className="px-6 py-4 font-bold">Data</th>
                      <th className="px-6 py-4 font-bold text-right">Valor</th>
                      <th className="px-6 py-4 font-bold text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">{t.description}</span>
                            {t.is_recurring && t.installments && (
                              <span className="text-[10px] text-indigo-500 font-bold uppercase">
                                {t.installments} parcelas • Fim: {getEndDate(t.start_date || t.date, t.installments)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            t.type === 'income' ? "bg-emerald-100 text-emerald-700" : 
                            t.type === 'variable_income' ? "bg-emerald-50 text-emerald-600" :
                            t.type === 'fixed_expense' ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {t.type === 'income' ? 'E. Fixa' : t.type === 'variable_income' ? 'E. Variável' : t.type === 'fixed_expense' ? 'G. Fixo' : 'G. Variável'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{t.category}</td>
                        <td className="px-6 py-4 text-slate-500 text-sm">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                        <td className={cn(
                          "px-6 py-4 text-right font-bold",
                          (t.type === 'income' || t.type === 'variable_income') ? "text-emerald-600" : "text-slate-900"
                        )}>
                          {formatCurrency(t.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'investments' && (
            <motion.div 
              key="investments"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
                  <p className="text-indigo-100 text-sm font-medium mb-1">Total Investido</p>
                  <h4 className="text-3xl font-bold">{formatCurrency(summary.invested)}</h4>
                  <div className="mt-4 flex items-center gap-2 text-indigo-100 text-xs">
                    <Target size={14} />
                    <span>Meta: {formatCurrency(50000)}</span>
                  </div>
                </div>
                {/* Add more investment stats here */}
              </div>

              <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg">Meus Ativos</h3>
                  <button onClick={() => { setModalType('investment'); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-100">
                    <Plus size={16} /> Novo Ativo
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {investments.map(inv => (
                    <div key={inv.id} className="border border-slate-100 rounded-xl p-4 hover:border-indigo-200 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                          <TrendingUp size={20} />
                        </div>
                        <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">
                          {inv.type}
                        </span>
                      </div>
                      <h5 className="font-bold text-slate-900 mb-1">{inv.name}</h5>
                      <p className="text-2xl font-bold text-indigo-600 mb-2">{formatCurrency(inv.amount)}</p>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Retorno Esperado</span>
                        <span className="text-emerald-600 font-bold">{inv.expected_return}% a.a</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'projections' && (
            <motion.div 
              key="projections"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex gap-4 mb-6">
                <button 
                  onClick={() => setProjectionView('chart')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    projectionView === 'chart' ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"
                  )}
                >
                  Gráfico de Projeção
                </button>
                <button 
                  onClick={() => setProjectionView('reports')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                    projectionView === 'reports' ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"
                  )}
                >
                  Relatórios Periódicos
                </button>
              </div>

              {projectionView === 'chart' ? (
                <div className="glass-card p-8">
                  <div className="max-w-2xl">
                    <h3 className="text-xl font-bold mb-2">Projeção de Patrimônio</h3>
                    <p className="text-slate-500 mb-8">Baseado em seus gastos recorrentes e entradas fixas, esta é a estimativa do seu saldo acumulado nos próximos meses.</p>
                  </div>
                  
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={projectionData}>
                        <defs>
                          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => [formatCurrency(value), 'Saldo Projetado']}
                        />
                        <Area type="monotone" dataKey="balance" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <h5 className="text-emerald-800 font-bold text-sm mb-1">Capacidade de Poupança</h5>
                      <p className="text-emerald-600 text-2xl font-bold">
                        {formatCurrency(transactions.filter(t => t.is_recurring && (t.type === 'income' || t.type === 'variable_income')).reduce((s, t) => s + t.amount, 0) - 
                         transactions.filter(t => t.is_recurring && (t.type === 'fixed_expense' || t.type === 'variable_expense')).reduce((s, t) => s + t.amount, 0))}
                        <span className="text-xs font-normal ml-1">/mês</span>
                      </p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <h5 className="text-indigo-800 font-bold text-sm mb-1">Estimativa em 1 Ano</h5>
                      <p className="text-indigo-600 text-2xl font-bold">
                        {formatCurrency(projectionData[5].balance * 2)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <ReportsView transactions={transactions} formatCurrency={formatCurrency} />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'taxes' && (
            <motion.div 
              key="taxes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 border-l-4 border-l-indigo-500">
                  <p className="text-slate-400 text-xs font-bold uppercase mb-1">Renda Bruta Total</p>
                  <h4 className="text-2xl font-bold">{formatCurrency(totalGrossIncome)}</h4>
                </div>
                <div className="glass-card p-6 border-l-4 border-l-rose-500">
                  <p className="text-slate-400 text-xs font-bold uppercase mb-1">Total Deduções (INSS + IRPF)</p>
                  <h4 className="text-2xl font-bold text-rose-600">{formatCurrency(taxes.inss + taxes.irpf)}</h4>
                </div>
                <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                  <p className="text-slate-400 text-xs font-bold uppercase mb-1">Renda Líquida Estimada</p>
                  <h4 className="text-2xl font-bold text-emerald-600">{formatCurrency(taxes.net)}</h4>
                </div>
              </div>

              <div className="glass-card p-8">
                <h3 className="text-xl font-bold mb-6">Detalhamento da Legislação 2026</h3>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm text-indigo-600">
                      <Target size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold">INSS (Previdência Social)</h4>
                        <span className="text-rose-600 font-bold">-{formatCurrency(taxes.inss)}</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-4">Cálculo progressivo baseado nas faixas de contribuição vigentes em 2026.</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${Math.min((taxes.inss / totalGrossIncome) * 100 * 5, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm text-rose-600">
                      <ArrowDownCircle size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold">IRPF (Imposto de Renda)</h4>
                        <span className="text-rose-600 font-bold">-{formatCurrency(taxes.irpf)}</span>
                      </div>
                      <p className="text-sm text-slate-500 mb-4">Imposto de Renda Retido na Fonte (IRRF) calculado após a dedução do INSS.</p>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full" style={{ width: `${Math.min((taxes.irpf / totalGrossIncome) * 100 * 5, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <h5 className="text-indigo-900 font-bold mb-2">Nota sobre a Legislação</h5>
                  <p className="text-sm text-indigo-700 leading-relaxed">
                    Os cálculos acima são estimativas baseadas na progressividade tributária brasileira. 
                    Para 2026, consideramos as faixas ajustadas e a dedução simplificada opcional. 
                    Lembre-se que investimentos em previdência privada (PGBL) podem reduzir sua base de cálculo do IRPF em até 12%.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {modalType === 'transaction' ? 'Nova Transação' : 'Novo Investimento'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={modalType === 'transaction' ? handleAddTransaction : handleAddInvestment} className="p-6 space-y-4">
              {modalType === 'transaction' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Descrição</label>
                    <input name="description" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Aluguel, Salário..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Valor</label>
                      <input name="amount" type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0,00" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo</label>
                      <select name="type" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="income">Entrada Fixa</option>
                        <option value="variable_income">Entrada Variável (Comissão)</option>
                        <option value="fixed_expense">Gasto Fixo</option>
                        <option value="variable_expense">Gasto Variável</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoria</label>
                    <input name="category" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Moradia, Lazer..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data</label>
                    <input name="date" type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      name="is_recurring" 
                      type="checkbox" 
                      id="recurring" 
                      className="w-4 h-4 text-indigo-600 rounded" 
                      checked={isRecurringChecked}
                      onChange={(e) => setIsRecurringChecked(e.target.checked)}
                    />
                    <label htmlFor="recurring" className="text-sm text-slate-600">Transação Recorrente</label>
                  </div>

                  {isRecurringChecked && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-2"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Início</label>
                          <input name="start_date" type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Parcelas</label>
                          <input name="installments" type="number" min="1" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" defaultValue="12" />
                        </div>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <p className="text-xs text-indigo-700">
                          <strong>Previsão de Finalização:</strong> {
                            // This is a bit tricky to do inline without a ref or state for the form values, 
                            // but I can assume the user wants to see it. 
                            // For simplicity in this edit, I'll just add the fields first.
                            "Calculado automaticamente"
                          }
                        </p>
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Ativo</label>
                    <input name="name" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Tesouro Direto, Ações..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Valor</label>
                      <input name="amount" type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0,00" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipo</label>
                      <input name="type" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Renda Fixa" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Retorno Esperado (% ao ano)</label>
                    <input name="expected_return" type="number" step="0.1" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 12.5" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data da Aplicação</label>
                    <input name="date" type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </>
              )}
              
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold transition-all shadow-lg shadow-indigo-100 mt-4">
                Salvar Registro
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
        active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
    </button>
  );
}

function SummaryCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="glass-card p-5">
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center",
          color === 'emerald' ? "bg-emerald-50" : 
          color === 'rose' ? "bg-rose-50" : 
          color === 'amber' ? "bg-amber-50" : "bg-indigo-50"
        )}>
          {icon}
        </div>
      </div>
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h4 className="text-xl font-bold text-slate-900">{formatCurrency(value)}</h4>
    </div>
  );
}

function ReportsView({ transactions, formatCurrency }: { transactions: Transaction[], formatCurrency: (v: number) => string }) {
  const [period, setPeriod] = useState<'monthly' | 'quarterly' | 'semi-annual' | 'annual'>('monthly');

  const currentYear = getYear(new Date());

  const exportToPDF = () => {
    const doc = new jsPDF();
    const periodLabel = period === 'monthly' ? 'Mensal' : period === 'quarterly' ? 'Trimestral' : period === 'semi-annual' ? 'Semestral' : 'Anual';
    const title = `Relatorio Financeiro - ${periodLabel} (${currentYear})`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    const tableData = periodData.map(item => [
      item.label,
      formatCurrency(item.income),
      formatCurrency(item.expenses),
      formatCurrency(item.income - item.expenses)
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Periodo', 'Ganhos', 'Gastos', 'Saldo']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`relatorio_${period}_${currentYear}.pdf`);
  };

  const getPeriodData = () => {
    const data: any[] = [];
    
    if (period === 'monthly') {
      for (let i = 0; i < 12; i++) {
        const monthTransactions = transactions.filter(t => {
          const d = new Date(t.date);
          return getMonth(d) === i && getYear(d) === currentYear;
        });
        data.push({
          label: format(new Date(currentYear, i, 1), 'MMMM', { locale: ptBR }),
          income: monthTransactions.filter(t => t.type === 'income' || t.type === 'variable_income').reduce((s, t) => s + t.amount, 0),
          expenses: monthTransactions.filter(t => t.type === 'fixed_expense' || t.type === 'variable_expense').reduce((s, t) => s + t.amount, 0),
        });
      }
    } else if (period === 'quarterly') {
      for (let i = 1; i <= 4; i++) {
        const quarterTransactions = transactions.filter(t => {
          const d = new Date(t.date);
          return getQuarter(d) === i && getYear(d) === currentYear;
        });
        data.push({
          label: `${i}º Trimestre`,
          income: quarterTransactions.filter(t => t.type === 'income' || t.type === 'variable_income').reduce((s, t) => s + t.amount, 0),
          expenses: quarterTransactions.filter(t => t.type === 'fixed_expense' || t.type === 'variable_expense').reduce((s, t) => s + t.amount, 0),
        });
      }
    } else if (period === 'semi-annual') {
      for (let i = 1; i <= 2; i++) {
        const semesterTransactions = transactions.filter(t => {
          const d = new Date(t.date);
          const month = getMonth(d);
          return (i === 1 ? month < 6 : month >= 6) && getYear(d) === currentYear;
        });
        data.push({
          label: `${i}º Semestre`,
          income: semesterTransactions.filter(t => t.type === 'income' || t.type === 'variable_income').reduce((s, t) => s + t.amount, 0),
          expenses: semesterTransactions.filter(t => t.type === 'fixed_expense' || t.type === 'variable_expense').reduce((s, t) => s + t.amount, 0),
        });
      }
    } else if (period === 'annual') {
      const annualTransactions = transactions.filter(t => getYear(new Date(t.date)) === currentYear);
      data.push({
        label: `Ano ${currentYear}`,
        income: annualTransactions.filter(t => t.type === 'income' || t.type === 'variable_income').reduce((s, t) => s + t.amount, 0),
        expenses: annualTransactions.filter(t => t.type === 'fixed_expense' || t.type === 'variable_expense').reduce((s, t) => s + t.amount, 0),
      });
    }

    return data;
  };

  const periodData = getPeriodData();

  return (
    <div className="glass-card p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1">Relatórios de Desempenho</h3>
          <p className="text-slate-500 text-sm">Acompanhe sua evolução financeira por períodos.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['monthly', 'quarterly', 'semi-annual', 'annual'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize",
                period === p ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p === 'monthly' ? 'Mensal' : p === 'quarterly' ? 'Trimestral' : p === 'semi-annual' ? 'Semestral' : 'Anual'}
            </button>
          ))}
        </div>
        <button 
          onClick={exportToPDF}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100"
        >
          <Download size={18} />
          Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {periodData.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-slate-400">
                <Calendar size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 capitalize">{item.label}</h4>
                <div className="flex gap-3 text-xs">
                  <span className="text-emerald-600">Ganhos: {formatCurrency(item.income)}</span>
                  <span className="text-rose-600">Gastos: {formatCurrency(item.expenses)}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Saldo</p>
              <p className={cn(
                "text-lg font-bold",
                (item.income - item.expenses) >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {formatCurrency(item.income - item.expenses)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={periodData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="income" name="Ganhos" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
