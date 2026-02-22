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
  Download,
  Smartphone,
  Monitor,
  Moon,
  Sun,
  Flag,
  BarChart3,
  FileUp,
  BrainCircuit,
  AlertCircle
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
import { Transaction, Investment, Summary, Goal, Budget } from './types';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899'];

export default function App() {
  const [viewMode, setViewMode] = useState<'mobile' | 'web' | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'investments' | 'projections' | 'taxes' | 'goals' | 'budgets'>('dashboard');
  const [projectionView, setProjectionView] = useState<'chart' | 'reports'>('chart');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<Summary>({ income: 0, variable_income: 0, fixed: 0, variable: 0, invested: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'transaction' | 'investment' | 'goal' | 'budget'>('transaction');
  const [isRecurringChecked, setIsRecurringChecked] = useState(false);
  const [recurringStartDate, setRecurringStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurringInstallments, setRecurringInstallments] = useState(12);
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const generateInsights = async () => {
    setIsAiLoading(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Analise os seguintes dados financeiros e forneça 3 insights curtos e práticos em português para melhorar a saúde financeira:
      Transações: ${JSON.stringify(transactions.slice(0, 20))}
      Metas: ${JSON.stringify(goals)}
      Orçamentos: ${JSON.stringify(budgets)}
      Responda apenas com os 3 insights em formato de lista, sem introdução.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      const text = response.text || "";
      setAiInsights(text.split('\n').filter(line => line.trim()));
    } catch (error) {
      console.error("Error generating insights:", error);
      setAiInsights(["Não foi possível gerar insights no momento. Tente novamente mais tarde."]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        const [description, amount, type, category, date] = line.split(',');
        if (description && amount) {
          await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: description.trim(),
              amount: parseFloat(amount),
              type: type.trim(),
              category: category.trim(),
              date: date.trim(),
              is_recurring: false
            })
          });
        }
      }
      fetchData();
    };
    reader.readAsText(file);
  };

  const fetchData = async () => {
    try {
      const [tRes, iRes, sRes, gRes, bRes] = await Promise.all([
        fetch('/api/transactions'),
        fetch('/api/investments'),
        fetch('/api/summary'),
        fetch('/api/goals'),
        fetch('/api/budgets')
      ]);
      setTransactions(await tRes.json());
      setInvestments(await iRes.json());
      setSummary(await sRes.json());
      setGoals(await gRes.json());
      setBudgets(await bRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      target_amount: parseFloat(formData.get('target_amount') as string),
      current_amount: parseFloat(formData.get('current_amount') as string),
      deadline: formData.get('deadline'),
      category: formData.get('category')
    };

    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    setIsModalOpen(false);
    fetchData();
  };

  const handleAddBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      category: formData.get('category'),
      limit_amount: parseFloat(formData.get('limit_amount') as string)
    };

    await fetch('/api/budgets', {
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
    <>
      <AnimatePresence mode="wait">
      {!viewMode ? (
        <motion.div 
          key="selector"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen bg-slate-900 flex items-center justify-center p-6"
        >
          <div className="max-w-4xl w-full text-center">
            <motion.div 
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="mb-12"
            >
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-500/20">
                <Wallet size={32} />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Bem-vindo ao FinPro</h1>
              <p className="text-slate-400 text-lg">Escolha como deseja visualizar sua experiência financeira hoje.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button 
                onClick={() => setViewMode('mobile')}
                className="group relative bg-slate-800 border-2 border-slate-700 hover:border-indigo-500 rounded-3xl p-8 transition-all hover:scale-[1.02] text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Smartphone size={120} />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <Smartphone size={24} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Versão Mobile</h3>
                  <p className="text-slate-400">Layout otimizado para telas pequenas, com navegação simplificada e foco em agilidade.</p>
                </div>
              </button>

              <button 
                onClick={() => setViewMode('web')}
                className="group relative bg-slate-800 border-2 border-slate-700 hover:border-indigo-500 rounded-3xl p-8 transition-all hover:scale-[1.02] text-left overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Monitor size={120} />
                </div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <Monitor size={24} />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Versão Web</h3>
                  <p className="text-slate-400">Experiência completa em desktop, com dashboards detalhados e visualização ampla de dados.</p>
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            "min-h-screen flex transition-all duration-500",
            viewMode === 'mobile' ? "max-w-[450px] mx-auto shadow-2xl border-x border-slate-200 flex-col bg-slate-50 pb-24" : "w-full bg-slate-50"
          )}
        >
          {/* Sidebar (Web) or Bottom Nav (Mobile) */}
          {viewMode === 'web' ? (
            <aside className="bg-white border-r border-slate-200 flex flex-col w-64 shrink-0">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
                    <Wallet size={20} />
                  </div>
                  <h1 className="font-bold text-xl tracking-tight">FinPro</h1>
                </div>

                <nav className="space-y-1">
                  <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                  <SidebarItem icon={<ArrowDownCircle size={20} />} label="Transações" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
                  <SidebarItem icon={<TrendingUp size={20} />} label="Investimentos" active={activeTab === 'investments'} onClick={() => setActiveTab('investments')} />
                  <SidebarItem icon={<LineChartIcon size={20} />} label="Projeções" active={activeTab === 'projections'} onClick={() => setActiveTab('projections')} />
                  <SidebarItem icon={<Calendar size={20} />} label="Impostos" active={activeTab === 'taxes'} onClick={() => setActiveTab('taxes')} />
                  <SidebarItem icon={<Flag size={20} />} label="Metas" active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} />
                  <SidebarItem icon={<BarChart3 size={20} />} label="Orçamentos" active={activeTab === 'budgets'} onClick={() => setActiveTab('budgets')} />
                </nav>
              </div>

              <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="text-xs font-bold uppercase">{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                  </button>
                  <button onClick={() => setViewMode(null)} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-2 rounded-lg transition-colors flex items-center justify-center">
                    <Smartphone size={20} />
                  </button>
                </div>
                <button 
                  onClick={() => { setModalType('transaction'); setIsModalOpen(true); }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 font-medium"
                >
                  <Plus size={20} />
                  Novo Registro
                </button>
              </div>
            </aside>
          ) : (
            <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 z-40 px-2 pb-safe">
              <div className="max-w-[450px] mx-auto flex justify-around items-center h-24">
                <MobileNavItem icon={<LayoutDashboard />} label="Início" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                <MobileNavItem icon={<ArrowDownCircle />} label="Extrato" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
                <div className="relative -top-8">
                  <button 
                    onClick={() => { setModalType('transaction'); setIsModalOpen(true); }}
                    className="w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Plus size={32} />
                  </button>
                </div>
                <MobileNavItem icon={<TrendingUp />} label="Invest" active={activeTab === 'investments'} onClick={() => setActiveTab('investments')} />
                <MobileNavItem icon={<Flag />} label="Metas" active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} />
              </div>
            </nav>
          )}

          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-y-auto",
            viewMode === 'mobile' ? "p-5" : "p-8"
          )}>
            <header className="flex justify-between items-center mb-8">
              <div>
                <h2 className={cn(
                  "font-bold text-slate-900 dark:text-white capitalize",
                  viewMode === 'mobile' ? "text-2xl" : "text-3xl"
                )}>
                  {activeTab === 'dashboard' ? 'Visão Geral' : 
                   activeTab === 'transactions' ? 'Transações' : 
                   activeTab === 'investments' ? 'Investimentos' : 
                   activeTab === 'projections' ? 'Projeções' : 
                   activeTab === 'goals' ? 'Metas' : 
                   activeTab === 'budgets' ? 'Orçamentos' : 'Impostos'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
              
              {viewMode === 'mobile' && (
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 shadow-sm active:scale-95 transition-transform"
                >
                  {darkMode ? <Sun size={24} /> : <Moon size={24} />}
                </button>
              )}
            </header>

            <div className="mb-8">
              <div className="glass-card p-6 bg-indigo-600 text-white border-none shadow-xl shadow-indigo-200">
                <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Saldo Total Disponível</p>
                <h3 className={cn(
                  "font-bold",
                  viewMode === 'mobile' ? "text-3xl" : "text-4xl"
                )}>
                  {formatCurrency(summary.income + summary.variable_income - summary.fixed - summary.variable)}
                </h3>
              </div>
            </div>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* AI Insights Section */}
              <div className="glass-card p-6 bg-gradient-to-br from-indigo-600 to-violet-700 border-none text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <BrainCircuit size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <BrainCircuit size={20} />
                      Insights Inteligentes
                    </h3>
                    <button 
                      onClick={generateInsights}
                      disabled={isAiLoading}
                      className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                    >
                      {isAiLoading ? 'Analisando...' : 'Atualizar'}
                    </button>
                  </div>
                  
                  {aiInsights.length > 0 ? (
                    <div className="space-y-3">
                      {aiInsights.map((insight, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-start gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm"
                        >
                          <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold">{idx + 1}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{insight}</p>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-indigo-100 text-sm mb-4">Clique em atualizar para receber dicas personalizadas da nossa IA.</p>
                    </div>
                  )}
                </div>
              </div>

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
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card">
                  <div className={cn(
                    "p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center",
                    viewMode === 'mobile' && "flex-col gap-4 items-stretch"
                  )}>
                    <h3 className="font-bold text-lg">Histórico Completo</h3>
                    <div className="flex gap-2">
                      <label className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors">
                        <FileUp size={20} /> Importar CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                      </label>
                      <button onClick={() => { setModalType('transaction'); setIsModalOpen(true); }} className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none">
                        <Plus size={20} /> Adicionar
                      </button>
                    </div>
                  </div>
                  
                  {viewMode === 'web' ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-bold">Descrição</th>
                            <th className="px-6 py-4 font-bold">Tipo</th>
                            <th className="px-6 py-4 font-bold">Categoria</th>
                            <th className="px-6 py-4 font-bold">Data</th>
                            <th className="px-6 py-4 font-bold text-right">Valor</th>
                            <th className="px-6 py-4 font-bold text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {transactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-900 dark:text-white">{t.description}</span>
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
                              <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{t.category}</td>
                              <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{format(new Date(t.date), 'dd/MM/yyyy')}</td>
                              <td className={cn(
                                "px-6 py-4 text-right font-bold",
                                (t.type === 'income' || t.type === 'variable_income') ? "text-emerald-600" : "text-slate-900 dark:text-white"
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
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactions.map(t => (
                        <div key={t.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                              (t.type === 'income' || t.type === 'variable_income') ? "bg-emerald-100 text-emerald-600" : 
                              t.type === 'fixed_expense' ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                            )}>
                              {(t.type === 'income' || t.type === 'variable_income') ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{t.description}</p>
                              <p className="text-xs text-slate-400">
                                {t.category} • {format(new Date(t.date), 'dd MMM yyyy', { locale: ptBR })}
                              </p>
                              {t.is_recurring && t.installments && (
                                <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">
                                  {t.installments} parcelas • Fim: {getEndDate(t.start_date || t.date, t.installments)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <p className={cn(
                              "font-bold text-lg",
                              (t.type === 'income' || t.type === 'variable_income') ? "text-emerald-600" : "text-slate-900 dark:text-white"
                            )}>
                              {(t.type === 'income' || t.type === 'variable_income') ? '+' : '-'} {formatCurrency(t.amount)}
                            </p>
                            <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-rose-500 p-1">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <CalendarView transactions={transactions} />
                  
                  <div className="glass-card p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold flex items-center gap-2">
                        <BarChart3 size={18} className="text-slate-400" />
                        Orçamentos Ativos
                      </h3>
                      <button onClick={() => { setModalType('budget'); setIsModalOpen(true); }} className="text-indigo-600 text-xs font-bold hover:underline">Configurar</button>
                    </div>
                    <div className="space-y-4">
                      {budgets.length > 0 ? budgets.map(budget => {
                        const spent = transactions
                          .filter(t => t.category === budget.category && (t.type === 'fixed_expense' || t.type === 'variable_expense'))
                          .reduce((sum, t) => sum + t.amount, 0);
                        const percent = (spent / budget.limit_amount) * 100;
                        
                        return (
                          <div key={budget.id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-bold text-slate-700 dark:text-slate-300">{budget.category}</span>
                              <span className={cn(
                                "font-bold",
                                percent > 90 ? "text-rose-600" : percent > 70 ? "text-amber-600" : "text-slate-500"
                              )}>
                                {formatCurrency(spent)} / {formatCurrency(budget.limit_amount)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-500",
                                  percent > 90 ? "bg-rose-500" : percent > 70 ? "bg-amber-500" : "bg-indigo-500"
                                )} 
                                style={{ width: `${Math.min(percent, 100)}%` }} 
                              />
                            </div>
                            {percent > 90 && (
                              <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-bold">
                                <AlertCircle size={10} /> Limite quase atingido!
                              </p>
                            )}
                          </div>
                        );
                      }) : (
                        <p className="text-xs text-slate-400 text-center py-4 italic">Nenhum orçamento configurado.</p>
                      )}
                    </div>
                  </div>
                </div>
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
                  <button onClick={() => { setModalType('investment'); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-100">
                    <Plus size={20} /> Novo Ativo
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {investments.map(inv => (
                    <div key={inv.id} className="border border-slate-100 rounded-2xl p-5 hover:border-indigo-200 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                          <TrendingUp size={24} />
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
              <div className="flex gap-4 mb-6 overflow-x-auto no-scrollbar pb-2">
                <button 
                  onClick={() => setProjectionView('chart')}
                  className={cn(
                    "px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none",
                    projectionView === 'chart' ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"
                  )}
                >
                  Gráfico de Projeção
                </button>
                <button 
                  onClick={() => setProjectionView('reports')}
                  className={cn(
                    "px-6 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-1 md:flex-none",
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
                  <ReportsView transactions={transactions} formatCurrency={formatCurrency} viewMode={viewMode!} />
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
          {activeTab === 'goals' && (
            <motion.div 
              key="goals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Minhas Metas Financeiras</h3>
                <button onClick={() => { setModalType('goal'); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none">
                  <Plus size={18} /> Nova Meta
                </button>
              </div>
              <GoalsView goals={goals} formatCurrency={formatCurrency} onDelete={async (id) => {
                await fetch(`/api/goals/${id}`, { method: 'DELETE' });
                fetchData();
              }} />
            </motion.div>
          )}
          {activeTab === 'budgets' && (
            <motion.div 
              key="budgets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Gestão de Orçamentos</h3>
                <button onClick={() => { setModalType('budget'); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-none">
                  <Plus size={18} /> Novo Orçamento
                </button>
              </div>
              <BudgetsView budgets={budgets} transactions={transactions} formatCurrency={formatCurrency} onDelete={async (id) => {
                await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
                fetchData();
              }} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  )}
</AnimatePresence>

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
                {modalType === 'transaction' ? 'Nova Transação' : 
                 modalType === 'investment' ? 'Novo Investimento' :
                 modalType === 'goal' ? 'Nova Meta' : 'Configurar Orçamento'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={
              modalType === 'transaction' ? handleAddTransaction : 
              modalType === 'investment' ? handleAddInvestment :
              modalType === 'goal' ? handleAddGoal : handleAddBudget
            } className="p-6 space-y-4">
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
                          <input 
                            name="start_date" 
                            type="date" 
                            required 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                            defaultValue={new Date().toISOString().split('T')[0]} 
                            onChange={(e) => setRecurringStartDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Parcelas</label>
                          <input 
                            name="installments" 
                            type="number" 
                            min="1" 
                            required 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                            defaultValue="12" 
                            onChange={(e) => setRecurringInstallments(parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <p className="text-xs text-indigo-700">
                          <strong>Previsão de Finalização:</strong> {
                            recurringStartDate && recurringInstallments > 0 
                              ? format(addMonths(new Date(recurringStartDate), recurringInstallments - 1), 'dd/MM/yyyy')
                              : "Calculado automaticamente"
                          }
                        </p>
                      </div>
                    </motion.div>
                  )}
                </>
              ) : modalType === 'investment' ? (
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
              ) : modalType === 'goal' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome da Meta</label>
                    <input name="name" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Viagem, Carro Novo..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Valor Alvo</label>
                      <input name="target_amount" type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0,00" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Valor Atual</label>
                      <input name="current_amount" type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" defaultValue="0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoria</label>
                    <input name="category" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Sonhos, Reserva..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Prazo (Deadline)</label>
                    <input name="deadline" type="date" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Categoria</label>
                    <input name="category" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Alimentação, Lazer..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Limite Mensal</label>
                    <input name="limit_amount" type="number" step="0.01" required className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0,00" />
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
    </>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl transition-all active:scale-90",
        active ? "text-indigo-600" : "text-slate-400"
      )}
    >
      <div className={cn(
        "p-2 rounded-xl transition-all",
        active ? "bg-indigo-50" : "bg-transparent"
      )}>
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center rounded-xl transition-all font-medium",
        label ? "gap-3 px-4 py-3" : "justify-center p-3",
        active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      )}
      title={label}
    >
      {icon}
      {label && <span>{label}</span>}
      {active && label && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />}
      {active && !label && <motion.div layoutId="active-pill" className="absolute right-1 w-1 h-4 rounded-full bg-indigo-600" />}
    </button>
  );
}

function SummaryCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-start mb-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center",
          color === 'emerald' ? "bg-emerald-50 text-emerald-600" : 
          color === 'rose' ? "bg-rose-50 text-rose-600" : 
          color === 'amber' ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
        )}>
          {React.cloneElement(icon as React.ReactElement, { size: 24 })}
        </div>
      </div>
      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h4 className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(value)}</h4>
    </div>
  );
}

function ReportsView({ transactions, formatCurrency, viewMode }: { transactions: Transaction[], formatCurrency: (v: number) => string, viewMode: 'mobile' | 'web' }) {
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
    <div className={cn(
      "glass-card",
      viewMode === 'mobile' ? "p-5" : "p-8"
    )}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1">Relatórios de Desempenho</h3>
          <p className="text-slate-500 text-sm">Acompanhe sua evolução financeira por períodos.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
          {(['monthly', 'quarterly', 'semi-annual', 'annual'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2.5 rounded-lg text-xs font-bold transition-all capitalize whitespace-nowrap flex-1 md:flex-none",
                period === p ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p === 'monthly' ? 'Mensal' : p === 'quarterly' ? 'Trimestral' : p === 'semi-annual' ? 'Semestral' : 'Anual'}
            </button>
          ))}
        </div>
        <button 
          onClick={exportToPDF}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-100"
        >
          <Download size={20} />
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

function GoalsView({ goals, formatCurrency, onDelete }: { goals: Goal[], formatCurrency: (v: number) => string, onDelete: (id: number) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {goals.map(goal => {
        const progress = (goal.current_amount / goal.target_amount) * 100;
        return (
          <div key={goal.id} className="glass-card p-6 relative group">
            <button 
              onClick={() => onDelete(goal.id)}
              className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={16} />
            </button>
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
              <Flag size={24} />
            </div>
            <h4 className="font-bold text-lg mb-1">{goal.name}</h4>
            <p className="text-xs text-slate-400 uppercase font-bold mb-4">{goal.category}</p>
            
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Progresso</span>
              <span className="font-bold text-indigo-600">{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                className="bg-indigo-600 h-full"
              />
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Meta</p>
                <p className="font-bold">{formatCurrency(goal.target_amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Prazo</p>
                <p className="text-sm font-medium">{format(new Date(goal.deadline), 'MMM yyyy', { locale: ptBR })}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BudgetsView({ budgets, transactions, formatCurrency, onDelete }: { budgets: Budget[], transactions: Transaction[], formatCurrency: (v: number) => string, onDelete: (id: number) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {budgets.map(budget => {
        const spent = transactions
          .filter(t => t.category === budget.category && (t.type === 'fixed_expense' || t.type === 'variable_expense'))
          .reduce((sum, t) => sum + t.amount, 0);
        const percent = (spent / budget.limit_amount) * 100;
        
        return (
          <div key={budget.id} className="glass-card p-6 relative group">
            <button 
              onClick={() => onDelete(budget.id)}
              className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={16} />
            </button>
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 mb-4">
              <BarChart3 size={24} />
            </div>
            <h4 className="font-bold text-lg mb-1">{budget.category}</h4>
            
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-500">Gasto Atual</span>
              <span className={cn(
                "font-bold",
                percent > 90 ? "text-rose-600" : percent > 70 ? "text-amber-600" : "text-indigo-600"
              )}>
                {percent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-4">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(percent, 100)}%` }}
                className={cn(
                  "h-full",
                  percent > 90 ? "bg-rose-500" : percent > 70 ? "bg-amber-500" : "bg-indigo-600"
                )}
              />
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold">Limite</p>
                <p className="font-bold">{formatCurrency(budget.limit_amount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Disponível</p>
                <p className={cn(
                  "text-sm font-bold",
                  (budget.limit_amount - spent) >= 0 ? "text-emerald-600" : "text-rose-600"
                )}>
                  {formatCurrency(budget.limit_amount - spent)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ transactions }: { transactions: Transaction[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const daysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const days = Array.from({ length: daysInMonth(currentMonth) }).map((_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth(currentMonth) }).map((_, i) => i);

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-lg">Calendário de Pagamentos</h3>
        <div className="flex gap-2">
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, -1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight size={20} className="rotate-180" />
          </button>
          <span className="font-bold min-w-[120px] text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-400 uppercase">
            {d}
          </div>
        ))}
        {blanks.map(b => <div key={`b-${b}`} className="bg-white h-24 p-2" />)}
        {days.map(d => {
          const dateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d), 'yyyy-MM-dd');
          const dayTransactions = transactions.filter(t => t.date === dateStr);
          
          return (
            <div key={d} className="bg-white h-24 p-2 hover:bg-slate-50 transition-colors overflow-y-auto">
              <span className="text-xs font-bold text-slate-400">{d}</span>
              <div className="space-y-1 mt-1">
                {dayTransactions.map(t => (
                  <div key={t.id} className={cn(
                    "text-[8px] p-1 rounded font-bold truncate",
                    (t.type === 'income' || t.type === 'variable_income') ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                  )}>
                    {t.description}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
