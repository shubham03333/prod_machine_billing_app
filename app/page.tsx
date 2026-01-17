"use client"

import { useState, useEffect } from 'react'
import { Minus, LogIn, BarChart3, Trash2, Plus, RefreshCw, Edit, LogOut, Home as HomeIcon, FileText, Users, Phone, Fuel, Clock, User, Wrench, IndianRupee } from 'lucide-react'
import { StatsChart } from '../components/StatsChart'
import BillComponent from '../components/BillComponent'


const STANDARD_PRICES = {
  tractor: { hourly: 500, trip: 500, acre: 1500 },
  harvester: { hourly: 3000, trip: 3000, acre: 3000, guntha: 75 },
  excavator: { hourly: 1000, trip: 200, acre: 400, monthly: 0, work: 0 }
}

const MACHINES = [
  { id: 'harvester', name: 'Harvester', units: ['acre', 'guntha', 'hourly'] },
  { id: 'excavator', name: 'JCB', units: ['hourly', 'trip', 'monthly', 'work'] },
  { id: 'tractor', name: 'Tractor', units: ['hourly', 'trip'] }
]

const UNITS = ['hourly', 'trip', 'acre', 'guntha']

const parseQuantity = (input: string, unit: string) => {
  const trimmed = input.trim();
  const hasUnits = /acre|guntha/i.test(trimmed);

  if (!hasUnits) {
    if (unit === 'acre') {
      const parts = trimmed.split('.');
      if (parts.length === 2) {
        const acres = parseInt(parts[0]) || 0;
        const gunthas = parseInt(parts[1]) || 0;
        return acres + gunthas / 40;
      }
    }
    const num = parseFloat(trimmed);
    return isNaN(num) ? 0 : num;
  }

  const regex = /(\d+(?:\.\d+)?)\s*(acre|guntha)/gi;
  let totalGunthas = 0;
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    const value = parseFloat(match[1]);
    const unitType = match[2].toLowerCase();
    if (unitType === 'acre') {
      totalGunthas += value * 40;
    } else if (unitType === 'guntha') {
      totalGunthas += value;
    }
  }
  if (unit === 'guntha') {
    return totalGunthas;
  } else if (unit === 'acre') {
    return totalGunthas / 40;
  }
  return 0;
};

const formatQuantityForDisplay = (quantity: number, unit: string) => {
  if (unit === 'acre') {
    const acres = Math.floor(quantity);
    const gunthas = Math.round((quantity - acres) * 40);
    return `${acres}.${gunthas.toString().padStart(2, '0')}`;
  }
  return quantity.toString();
};

const formatDateDDMMYYYY = (date: string | Date) => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

interface User {
  id: number
  name: string
  role: string
}

interface Operator {
  id: number
  name: string
}

interface Payment {
  id: number
  rentalId: number
  amount: number
  mode: string
  date: string
}

interface Rental {
  id: number
  machineType: string
  unitType: string
  quantity: number
  acreage?: number
  pricePerUnit: number
  totalAmount: number
  description?: string
  customer: { name: string; address: string; contactNumber: string }
  operator: { name: string }
  date: string
  dieselCost: number
  maintenanceCost: number
  operatorSalary: number
  paidAmount: number
  paymentStatus: string
  paymentMode?: string
  advanceAmount: number
  createdAt: string
  payments: Payment[]
  billId?: number
  // JCB hourly specific fields
  normalHourlyRate?: number
  breakerHourlyRate?: number
  timeSlots?: Array<{ startTime?: string; endTime?: string; start?: string; end?: string; isBreaker: boolean; calculatedAmount: number }>
}

interface Expense {
  id: number
  description: string
  amount: number
  date: string
  operator: { name: string }
  dieselCost?: number
  maintenanceCost?: number
  operatorSalary?: number
  driverDrinkCost?: number
  createdAt: string
}

interface Customer {
  id: number
  name: string
  contactNumber: string
  address?: string
  totalRevenue: number
  totalRentals: number
  lastRentalDate: Date | null
  createdAt: string
}

interface Bill {
  id: number
  billNumber: string
  customer: { name: string; address?: string; contactNumber: string }
  rentals: Rental[]
  totalAmount: number
  paidAmount: number
  status: string
  dueDate?: string
  createdAt: string
}

export default function Home() {
  const [pin, setPin] = useState('')
  const [user, setUser] = useState<User | null>(null)

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
      } catch (error) {
        console.error('Error parsing stored user:', error)
        localStorage.removeItem('user')
      }
    }
  }, [])
  const [selectedMachine, setSelectedMachine] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [quantityText, setQuantityText] = useState('1')
  const [amount, setAmount] = useState('')
  const [timeSlots, setTimeSlots] = useState<{start: string, end: string, isBreaker: boolean, calculatedAmount: number}[]>([{start: '', end: '', isBreaker: false, calculatedAmount: 0}])
  const [normalHourlyRate, setNormalHourlyRate] = useState('1000')
  const [breakerHourlyRate, setBreakerHourlyRate] = useState('1500')

  const calculateHours = (start: string, end: string) => {
    if (!start || !end) return 0
    const startDate = new Date(`2000-01-01T${start}:00`)
    let endDate = new Date(`2000-01-01T${end}:00`)
    if (endDate < startDate) {
      endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000) // add 24 hours for overnight shifts
    }
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    return Math.max(0, diffHours)
  }

  const calculateTotalHours = (slots: {start: string, end: string}[]) => {
    return slots.reduce((total, slot) => total + calculateHours(slot.start, slot.end), 0)
  }

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, {start: '', end: '', isBreaker: false, calculatedAmount: 0}])
  }

  const removeTimeSlot = (index: number) => {
    const newSlots = timeSlots.filter((_, i) => i !== index)
    const finalSlots = newSlots.length === 0 ? [{start: '', end: '', isBreaker: false, calculatedAmount: 0}] : newSlots
    setTimeSlots(finalSlots)
    const totalHours = calculateTotalHours(finalSlots)
    setQuantity(totalHours)
  }

const updateTimeSlot = (index: number, field: 'start' | 'end', value: string) => {
  if (index < 0 || index >= timeSlots.length) return
  const newSlots = [...timeSlots]
  newSlots[index][field] = value
  // Recalculate amount for this slot
  const hours = calculateHours(newSlots[index].start, newSlots[index].end)
  const rate = newSlots[index].isBreaker ? (parseFloat(breakerHourlyRate) || 0) : (parseFloat(normalHourlyRate) || 0)
  newSlots[index].calculatedAmount = hours * rate
  setTimeSlots(newSlots)
  const totalHours = calculateTotalHours(newSlots)
  setQuantity(totalHours)
}

  const updateTimeSlotType = (index: number, isBreaker: boolean) => {
    const newSlots = [...timeSlots]
    newSlots[index].isBreaker = isBreaker
    // Recalculate amount for this slot
    const hours = calculateHours(newSlots[index].start, newSlots[index].end)
    const rate = isBreaker ? (parseFloat(breakerHourlyRate) || 0) : (parseFloat(normalHourlyRate) || 0)
    newSlots[index].calculatedAmount = hours * rate
    setTimeSlots(newSlots)
  }

  const setCurrentTime = (index: number, field: 'start' | 'end') => {
    const now = new Date()
    const timeString = now.toTimeString().slice(0, 5) // HH:MM format
    updateTimeSlot(index, field, timeString)
  }
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [description, setDescription] = useState('')
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const [dieselCost, setDieselCost] = useState('')
  const [maintenanceCost, setMaintenanceCost] = useState('')
  const [operatorSalary, setOperatorSalary] = useState('')
  const [otherExpenses, setOtherExpenses] = useState<{ key: string; value: string }[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [operators, setOperators] = useState<Operator[]>([])
  const [bills, setBills] = useState<Bill[]>([])
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | null>(null)
  const [expenseDescription, setExpenseDescription] = useState('')

  useEffect(() => {
    if (user) {
      setSelectedOperatorId(user.id)
    }
  }, [user])
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [expenseDieselCost, setExpenseDieselCost] = useState('')
  const [expenseMaintenanceCost, setExpenseMaintenanceCost] = useState('')
  const [expenseOperatorSalary, setExpenseOperatorSalary] = useState('')
  const [expenseDriverDrinkCost, setExpenseDriverDrinkCost] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mobileError, setMobileError] = useState('')
  const [filter, setFilter] = useState('today')
  const [prices, setPrices] = useState(STANDARD_PRICES)
  const [showEditRates, setShowEditRates] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'new-rental' | 'expenses' | 'rentals'>('new-rental')
  const [selectedRentalId, setSelectedRentalId] = useState<number | null>(null)
  const [adminActiveTab, setAdminActiveTab] = useState<'overview' | 'add-expense' | 'expenses' | 'customers' | 'bills'>('overview')
  const [expenseFilter, setExpenseFilter] = useState({
    dateFrom: '',
    dateTo: '',
    category: '',
    operator: '',
    jcbFilter: false
  })
const [rentalFilter, setRentalFilter] = useState({
  dateFrom: '',
  dateTo: '',
  machine: '',
  paymentStatus: '',
  contactNumber: '',
  customerSearch: '',
  addressSearch: ''
})
  const [searchQuery, setSearchQuery] = useState('')
  const [customerFilter, setCustomerFilter] = useState({
    contactNumber: ''
  })
  const [editingRental, setEditingRental] = useState<Rental | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentRental, setPaymentRental] = useState<Rental | null>(null)
  const [selectedRentalForBreakdown, setSelectedRentalForBreakdown] = useState<Rental | null>(null)
  const [selectedRentalForBill, setSelectedRentalForBill] = useState<Rental | null>(null)
  const [additionalAmount, setAdditionalAmount] = useState('')
  const [additionalPaymentMode, setAdditionalPaymentMode] = useState('Cash')
  const [billDetails, setBillDetails] = useState<any>(null)
  const [billLoading, setBillLoading] = useState(false)
  const [billError, setBillError] = useState('')
  const [showBillModal, setShowBillModal] = useState(false)
  const [selectedRentalsForBill, setSelectedRentalsForBill] = useState<Rental[]>([])
  const [billDueDate, setBillDueDate] = useState('')
  const [editCustomerData, setEditCustomerData] = useState({
    name: '',
    contactNumber: '',
    address: ''
  })
  const [showContactDropdown, setShowContactDropdown] = useState(false)
  const [contactSearch, setContactSearch] = useState('')
  const [operatorDateFrom, setOperatorDateFrom] = useState('')
  const [operatorDateTo, setOperatorDateTo] = useState('')

  // Fetch bill details when bill modal opens
  useEffect(() => {
    if (showBillModal && selectedRentalsForBill.length > 0 && selectedRentalsForBill[0].billId) {
      const fetchBillDetails = async () => {
        try {
          const res = await fetch(`/api/bills/${selectedRentalsForBill[0].billId}`)
          if (res.ok) {
            const bill = await res.json()
            setBillDetails(bill)
          } else {
            setError('Failed to fetch bill details')
          }
        } catch (err) {
          setError('Failed to fetch bill details')
        }
      }
      fetchBillDetails()
    } else {
      setBillDetails(null)
    }
  }, [showBillModal, selectedRentalsForBill])
  const [editCustomerMobileError, setEditCustomerMobileError] = useState('')
  const [operatorRentalsPage, setOperatorRentalsPage] = useState(1)
  const [editRentalData, setEditRentalData] = useState({
    machineType: '',
    unitType: '',
    quantity: '',
    pricePerUnit: '',
    totalAmount: '',
    description: '',
    customerName: '',
    customerContact: '',
    customerAddress: '',
    dieselCost: '',
    maintenanceCost: '',
    operatorSalary: '',
    paidAmount: '',
    paymentStatus: '',
    advanceAmount: '',
    paymentMode: '',
    additionalAmount: '',
    additionalPaymentMode: 'Cash',
    date: '',
    normalHourlyRate: '',
    breakerHourlyRate: '',
    timeSlots: [] as {start: string, end: string, isBreaker: boolean, calculatedAmount: number}[],
    normalHours: '',
    breakerHours: ''
  })
  const [originalPaidAmount, setOriginalPaidAmount] = useState(0)
  const [paidAmountError, setPaidAmountError] = useState('')

  // Auto-calculate total amount when quantity or price per unit changes
  useEffect(() => {
    const quantity = parseFloat(editRentalData.quantity) || 0
    const pricePerUnit = parseFloat(editRentalData.pricePerUnit) || 0
    const totalAmount = quantity * pricePerUnit
    setEditRentalData(prev => ({
      ...prev,
      totalAmount: totalAmount.toString()
    }))
  }, [editRentalData.quantity, editRentalData.pricePerUnit])
  const [editExpenseData, setEditExpenseData] = useState({
    description: '',
    amount: '',
    dieselCost: '',
    maintenanceCost: '',
    operatorSalary: '',
    date: '',
    operatorId: ''
  })

  const [overviewPage, setOverviewPage] = useState(1)
  const [expensesPage, setExpensesPage] = useState(1)
  const [customersPage, setCustomersPage] = useState(1)

  // Reset customers page when filter changes
  useEffect(() => {
    setCustomersPage(1)
  }, [customerFilter.contactNumber])

  useEffect(() => {
    if (user) {
      fetchRentals()
      fetchCustomers()
      fetchExpenses()
      fetchOperators()
      fetchBills()
    }
  }, [user])

  useEffect(() => {
    if (selectedUnit === 'monthly' || selectedUnit === 'work') {
      setQuantity(1)
      setAmount('')
    }
  }, [selectedUnit])

  const login = async () => {
    if (!pin) return

    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })

    const data = await res.json()
    if (res.ok) {
      setUser(data)
      localStorage.setItem('user', JSON.stringify(data))
      setError('')
    } else {
      setError(data.error)
    }
    } catch (err) {
      setError('Login failed')
    }
    setLoading(false)
  }

  const fetchRentals = async () => {
    try {
      const res = await fetch('/api/rentals')
      if (!res.ok) {
        throw new Error('Failed to fetch rentals')
      }
      const data = await res.json()
      setRentals(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch rentals')
      setRentals([])
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      setCustomers(data)
    } catch (err) {
      console.error('Failed to fetch customers')
    }
  }

const fetchExpenses = async () => {
  try {
    const res = await fetch('/api/expenses')
    const data = await res.json()
    setExpenses(data)
  } catch (err) {
    console.error('Failed to fetch expenses')
  }
}

const fetchOperators = async () => {
  try {
    const res = await fetch('/api/operators')
    const data = await res.json()
    setOperators(data)
  } catch (err) {
    console.error('Failed to fetch operators')
  }
}

const fetchBills = async () => {
  try {
    const res = await fetch('/api/bills')
    const data = await res.json()
    setBills(Array.isArray(data.bills) ? data.bills : [])
  } catch (err) {
    console.error('Failed to fetch bills')
    setBills([])
  }
}

  const saveExpense = async () => {
    if (!user) return

    let finalDescription = expenseDescription
    let finalAmount = expenseAmount

    // If amount is empty, sum the category fields
    if (!finalAmount) {
      const diesel = parseFloat(expenseDieselCost) || 0
      const maintenance = parseFloat(expenseMaintenanceCost) || 0
      const salary = parseFloat(expenseOperatorSalary) || 0
      const driverDrink = parseFloat(expenseDriverDrinkCost) || 0
      finalAmount = (diesel + maintenance + salary + driverDrink).toString()
    }

    // If description is empty, generate one based on filled categories
    if (!finalDescription) {
      const categories = []
      if (parseFloat(expenseDieselCost) > 0) categories.push('Diesel')
      if (parseFloat(expenseMaintenanceCost) > 0) categories.push('Maintenance')
      if (parseFloat(expenseOperatorSalary) > 0) categories.push('Operator Salary')
      if (parseFloat(expenseDriverDrinkCost) > 0) categories.push('Driver Drink')
      finalDescription = categories.length > 0 ? categories.join(', ') : 'Expense'
    }

    if (!finalDescription || !finalAmount) return

    setLoading(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: finalDescription,
          amount: finalAmount,
          operatorId: selectedOperatorId || user.id,
          date: expenseDate,
          dieselCost: expenseDieselCost ? parseFloat(expenseDieselCost) : undefined,
          maintenanceCost: expenseMaintenanceCost ? parseFloat(expenseMaintenanceCost) : undefined,
          operatorSalary: expenseOperatorSalary ? parseFloat(expenseOperatorSalary) : undefined,
          driverDrinkCost: expenseDriverDrinkCost ? parseFloat(expenseDriverDrinkCost) : undefined,
        })
      })

      if (res.ok) {
        fetchExpenses()
        setExpenseDescription('')
        setExpenseAmount('')
        setExpenseDieselCost('')
        setExpenseMaintenanceCost('')
        setExpenseOperatorSalary('')
        setSelectedOperatorId(null)
        setError('')
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to save expense')
    }
    setLoading(false)
  }

  const createRental = async () => {
    if (!selectedMachine || !selectedUnit || !user || !customerName || !customerContact || !customerAddress) return

    let pricePerUnit = prices[selectedMachine as keyof typeof prices][selectedUnit as keyof typeof prices[keyof typeof prices]]
    let totalAmount: number
    let normalRate: number | undefined
    let breakerRate: number | undefined
    let timeSlotsData: { startTime: string; endTime: string; isBreaker: boolean; calculatedAmount: number }[] | undefined

    if (selectedUnit === 'monthly' || selectedUnit === 'work') {
      totalAmount = parseFloat(amount) || 0
      pricePerUnit = totalAmount // Set price per unit to the amount for consistency
    } else if (selectedMachine === 'excavator' && selectedUnit === 'hourly') {
      // JCB hourly work - calculate based on time slots
      const normalRateValue = parseFloat(normalHourlyRate) || 0
      const breakerRateValue = parseFloat(breakerHourlyRate) || 0
      timeSlotsData = timeSlots.map((slot) => ({
        startTime: slot.start,
        endTime: slot.end,
        isBreaker: slot.isBreaker,
        calculatedAmount: calculateHours(slot.start, slot.end) * (slot.isBreaker ? breakerRateValue : normalRateValue)
      }))
      totalAmount = timeSlotsData.reduce((sum, slot) => sum + slot.calculatedAmount, 0)
      pricePerUnit = normalRateValue
    } else {
      totalAmount = quantity * pricePerUnit
    }

    setLoading(true)
    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineType: selectedMachine,
          unitType: selectedUnit,
          quantity,
          pricePerUnit,
          totalAmount,
          description: description || undefined,
          customerName,
          customerContact,
          customerAddress,
          dieselCost: dieselCost ? parseFloat(dieselCost) : 0,
          maintenanceCost: maintenanceCost ? parseFloat(maintenanceCost) : 0,
          operatorSalary: operatorSalary ? parseFloat(operatorSalary) : 0,
          paidAmount: advanceAmount ? parseFloat(advanceAmount) : 0,
          paymentStatus: 'UNPAID',
          paymentMode: paymentMode || undefined,
          operatorId: selectedOperatorId || user.id,
          date: selectedDate,
          normalHourlyRate,
          breakerHourlyRate,
          timeSlots
        })
      })

      if (res.ok) {
        fetchRentals()
        fetchCustomers()
        setSelectedMachine('')
        setSelectedUnit('')
        setQuantity(1)
        setTimeSlots([{start: '', end: '', isBreaker: false, calculatedAmount: 0}])
        setCustomerName('')
        setCustomerContact('')
        setCustomerAddress('')
        setDieselCost('')
        setMaintenanceCost('')
        setOperatorSalary('')
        setError('')
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to create rental')
    }
    setLoading(false)
  }

  const deleteRental = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rental?')) return

    try {
      await fetch(`/api/rentals/${id}`, { method: 'DELETE' })
      fetchRentals()
    } catch (err) {
      console.error('Failed to delete rental')
    }
  }

  const startEditRental = (rental: Rental) => {
    let timeSlots = rental.timeSlots
    if (typeof timeSlots === 'string') {
      try {
        timeSlots = JSON.parse(timeSlots)
      } catch (e) {
        timeSlots = []
      }
    }
    const mappedTimeSlots = timeSlots ? timeSlots.map((slot: any) => ({ start: slot.startTime || slot.start || '', end: slot.endTime || slot.end || '', isBreaker: slot.isBreaker, calculatedAmount: slot.calculatedAmount })) : []
    const normalHours = mappedTimeSlots.filter((s: any) => !s.isBreaker).reduce((sum: number, s: any) => sum + calculateHours(s.start, s.end), 0).toString()
    const breakerHours = mappedTimeSlots.filter((s: any) => s.isBreaker).reduce((sum: number, s: any) => sum + calculateHours(s.start, s.end), 0).toString()
    setEditRentalData({
      machineType: rental.machineType,
      unitType: rental.unitType,
      quantity: rental.quantity.toString(),
      pricePerUnit: rental.pricePerUnit.toString(),
      totalAmount: rental.totalAmount.toString(),
      description: rental.description || '',
      customerName: rental.customer.name,
      customerContact: rental.customer.contactNumber,
      customerAddress: rental.customer.address || '',
      dieselCost: rental.dieselCost.toString(),
      maintenanceCost: rental.maintenanceCost.toString(),
      operatorSalary: rental.operatorSalary.toString(),
      paidAmount: rental.paidAmount.toString(),
      advanceAmount: (rental.advanceAmount || 0).toString(),
      paymentStatus: rental.paymentStatus,
      paymentMode: rental.paymentMode || '',
      additionalAmount: '',
      additionalPaymentMode: 'Cash',
      date: new Date(rental.date).toISOString().split('T')[0],
      normalHours,
      breakerHours,
      normalHourlyRate: rental.normalHourlyRate ? rental.normalHourlyRate.toString() : '',
      breakerHourlyRate: rental.breakerHourlyRate ? rental.breakerHourlyRate.toString() : '',
      timeSlots: mappedTimeSlots
    })
    setEditingRental(rental)
  }

  const updateRental = async () => {
    if (!editingRental) return

    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/${editingRental.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editRentalData)
      })

      if (res.ok) {
        fetchRentals()
        setEditingRental(null)
        setError('')
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to update rental')
    }
    setLoading(false)
  }

  const startEditExpense = (expense: Expense) => {
    setEditingExpense(expense)
    setEditExpenseData({
      description: expense.description,
      amount: expense.amount.toString(),
      dieselCost: (expense.dieselCost || 0).toString(),
      maintenanceCost: (expense.maintenanceCost || 0).toString(),
      operatorSalary: (expense.operatorSalary || 0).toString(),
      date: new Date(expense.date).toISOString().split('T')[0],
      operatorId: (expense as any).operatorId || ''
    })
  }

  const startEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setEditCustomerData({
      name: customer.name,
      contactNumber: customer.contactNumber,
      address: customer.address || ''
    })
  }

  const updateCustomer = async () => {
    if (!editingCustomer) return

    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editCustomerData)
      })

      if (res.ok) {
        fetchCustomers()
        setEditingCustomer(null)
        setError('')
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to update customer')
    }
    setLoading(false)
  }

  const updateExpense = async () => {
    if (!editingExpense) return

    setLoading(true)
    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editExpenseData)
      })

      if (res.ok) {
        fetchExpenses()
        setEditingExpense(null)
        setError('')
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to update expense')
    }
    setLoading(false)
  }

  const deleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      fetchExpenses()
    } catch (err) {
      console.error('Failed to delete expense')
    }
  }

  const deleteCustomer = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' })
      fetchCustomers()
    } catch (err) {
      console.error('Failed to delete customer')
    }
  }

  const addPayment = async () => {
    if (!paymentRental || !additionalAmount || !additionalPaymentMode) return

    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/${paymentRental.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: additionalAmount,
          mode: additionalPaymentMode
        })
      })

      if (res.ok) {
        await fetchRentals()
        setShowPaymentModal(false)
        setPaymentRental(null)
        setAdditionalAmount('')
        setAdditionalPaymentMode('Cash')
        setError('')
      } else {
        const data = await res.json()
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to add payment')
    }
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount)
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'UNPAID':
        return 'text-red-600'
      case 'PARTIALLY_PAID':
        return 'text-yellow-600'
      case 'PAID':
        return 'text-green-600'
      default:
        return ''
    }
  }

  const downloadCSV = (data: string[][], filename: string) => {
    const csv = data.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const exportRentalsToCSV = () => {
    const headers = ['Machine Type', 'Operator', 'Customer Name', 'Contact', 'Address', 'Quantity', 'Unit', 'Price Per Unit', 'Total Amount', 'Paid Amount', 'Payment Status', 'Date', 'Description', 'Diesel Cost', 'Maintenance Cost', 'Operator Salary'];
    const csvData = filteredRentals.map(r => [
      r.machineType,
      r.operator.name,
      r.customer.name,
      r.customer.contactNumber,
      r.customer.address || '',
      r.quantity.toString(),
      r.unitType,
      r.pricePerUnit.toString(),
      r.totalAmount.toString(),
      r.paidAmount.toString(),
      r.paymentStatus,
      formatDateDDMMYYYY(r.date),
      r.description || '',
      r.dieselCost.toString(),
      r.maintenanceCost.toString(),
      r.operatorSalary.toString()
    ]);
    downloadCSV([headers, ...csvData], 'rentals.csv');
  }

  const exportExpensesToCSV = () => {
    const headers = ['Description', 'Category', 'Operator', 'Amount', 'Date', 'Diesel Cost', 'Maintenance Cost', 'Operator Salary'];
    const csvData = filteredExpenses.map(e => [
      e.description,
      getExpenseCategory(e),
      e.operator.name,
      e.amount.toString(),
      new Date(e.date).toLocaleDateString(),
      (e.dieselCost || 0).toString(),
      (e.maintenanceCost || 0).toString(),
      (e.operatorSalary || 0).toString()
    ]);
    downloadCSV([headers, ...csvData], 'expenses.csv');
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <img src="/rentralogo.png" alt="JD Agro & Earthmovers Logo" className="mx-auto mb-4 w-32 h-auto" />
        <h1 className="text-2xl font-bold text-center mb-6">🚜 JD Agro & Earthmovers</h1>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full p-3 border rounded-lg text-center text-2xl text-black"
              maxLength={4}
            />
            <button
              onClick={login}
              disabled={loading}
              className="w-full bg-blue-500 text-white p-3 rounded-lg flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && <p className="text-red-500 text-center">{error}</p>}
          </div>
          <div className="mt-6 text-sm text-gray-600">
            {/* <p><strong>Test PINs:</strong></p>
            <p>Admin: 1234</p>
            <p>Operator: 3333 or 9999</p> */}
          </div>
        </div>
      </div>
    )
  }

const getExpenseCategory = (expense: Expense) => {
  if (expense.dieselCost !== undefined && expense.dieselCost > 0) return 'Diesel'
  if (expense.maintenanceCost !== undefined && expense.maintenanceCost > 0) return 'Maintenance'
  if (expense.operatorSalary !== undefined && expense.operatorSalary > 0) return 'Operator Salary'
  if (expense.driverDrinkCost !== undefined && expense.driverDrinkCost > 0) return 'Driver Drink'
  return 'Other'
}

  const filteredExpenses = (expenses || [])
    .filter(expense => {
      const expenseDate = new Date(expense.date)
      const fromDate = expenseFilter.dateFrom ? new Date(expenseFilter.dateFrom) : null
      const toDate = expenseFilter.dateTo ? new Date(expenseFilter.dateTo) : null

      if (fromDate && expenseDate < fromDate) return false
      if (toDate && expenseDate > toDate) return false
      if (expenseFilter.category && getExpenseCategory(expense) !== expenseFilter.category) return false
      if (expenseFilter.operator && expense.operator.name !== expenseFilter.operator) return false
      if (expenseFilter.jcbFilter && !expense.description.toLowerCase().startsWith('jcb')) return false

      return true
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const filteredRentals = (rentals || [])
    .filter(rental => {
      const rentalDate = new Date(rental.date)
      const fromDate = rentalFilter.dateFrom ? new Date(rentalFilter.dateFrom) : null
      const toDate = rentalFilter.dateTo ? new Date(rentalFilter.dateTo) : null

      if (fromDate && rentalDate < fromDate) return false
      if (toDate && rentalDate > toDate) return false
      if (rentalFilter.machine && rental.machineType !== rentalFilter.machine) return false
      if (rentalFilter.paymentStatus && rental.paymentStatus !== rentalFilter.paymentStatus) return false
      if (rentalFilter.contactNumber && !rental.customer.contactNumber.replace(/\s/g, '').includes(rentalFilter.contactNumber.replace(/\s/g, ''))) return false
      if (rentalFilter.customerSearch && !rental.customer.name.toLowerCase().includes(rentalFilter.customerSearch.toLowerCase())) return false

      return true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const filteredCustomers = (customers || [])
    .filter(customer => {
      if (customerFilter.contactNumber) {
        const filterNormalized = customerFilter.contactNumber.replace(/\D/g, '')
        const contactNormalized = customer.contactNumber ? customer.contactNumber.replace(/\D/g, '') : ''
        if (!contactNormalized.includes(filterNormalized)) return false
      }
      return true
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)

  const totalRentalsAmount = filteredRentals.reduce((sum, rental) => sum + rental.totalAmount, 0)

  const totalPaidAmount = filteredRentals.reduce((sum, rental) => sum + (rental.paidAmount || 0), 0)

  const totalPendingAmount = filteredRentals.reduce((sum, rental) => {
    if (rental.paymentStatus === 'PAID') return sum
    return sum + (rental.totalAmount - (rental.paidAmount || 0))
  }, 0)

  const totalAcre = filteredRentals.reduce((sum, rental) => {
    if (rental.unitType === 'acre') {
      return sum + rental.quantity;
    } else if (rental.unitType === 'guntha') {
      return sum + (rental.quantity / 40);
    }
    return sum;
  }, 0)

  const totalJCBHours = filteredRentals.reduce((sum, rental) => {
    if (rental.machineType === 'excavator' && rental.unitType === 'hourly') {
      let slots = rental.timeSlots;
      if (typeof slots === 'string') {
        try {
          slots = JSON.parse(slots);
        } catch (e) {
          slots = [];
        }
      }
      if (Array.isArray(slots)) {
        return sum + slots.reduce((slotSum, slot) => slotSum + calculateHours(slot.startTime || slot.start || '', slot.endTime || slot.end || ''), 0);
      }
    }
    return sum;
  }, 0)

  const totalBreakerHours = filteredRentals.reduce((sum, rental) => {
    if (rental.machineType === 'excavator' && rental.unitType === 'hourly') {
      let slots = rental.timeSlots;
      if (typeof slots === 'string') {
        try {
          slots = JSON.parse(slots);
        } catch (e) {
          slots = [];
        }
      }
      if (Array.isArray(slots)) {
        return sum + slots.filter(slot => slot.isBreaker).reduce((slotSum, slot) => slotSum + calculateHours(slot.startTime || slot.start || '', slot.endTime || slot.end || ''), 0);
      }
    }
    return sum;
  }, 0)

if (user.role === 'admin') {
  return (
    <>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-center sm:text-left">Admin Dashboard</h1>
          <div className="flex justify-center sm:justify-end">
            <button
              onClick={() => setUser(null)}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm sm:text-base"
            >
              Logout
            </button>
          </div>
        </div>

          <div className="flex flex-wrap gap-1 mb-6">
            <button
              onClick={() => setAdminActiveTab('overview')}
              className={`px-1 py-1 sm:px-2 sm:py-2 md:px-4 rounded-lg font-medium text-xs sm:text-sm md:text-base ${
                adminActiveTab === 'overview'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setAdminActiveTab('add-expense')}
              className={`px-1 py-1 sm:px-2 sm:py-2 md:px-4 rounded-lg font-medium text-xs sm:text-sm md:text-base ${
                adminActiveTab === 'add-expense'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Add Expense
            </button>
            <button
              onClick={() => setAdminActiveTab('expenses')}
              className={`px-1 py-1 sm:px-2 sm:py-2 md:px-4 rounded-lg font-medium text-xs sm:text-sm md:text-base ${
                adminActiveTab === 'expenses'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Expenses
            </button>
            <button
              onClick={() => setAdminActiveTab('customers')}
              className={`px-1 py-1 sm:px-2 sm:py-2 md:px-4 rounded-lg font-medium text-xs sm:text-sm md:text-base ${
                adminActiveTab === 'customers'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setAdminActiveTab('bills')}
              className={`px-1 py-1 sm:px-2 sm:py-2 md:px-4 rounded-lg font-medium text-xs sm:text-sm md:text-base ${
                adminActiveTab === 'bills'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Bills
            </button>
          </div>

          {adminActiveTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Total Revenue</h3>
                  <p className="text-3xl font-bold text-green-600">
                    {formatCurrency(rentals.reduce((sum, r) => sum + r.totalAmount, 0))}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Total Expenses</h3>
                  <p className="text-3xl font-bold text-red-600">
                    {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Net Profit</h3>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(
                      rentals.reduce((sum, r) => sum + r.totalAmount, 0) -
                      expenses.reduce((sum, e) => sum + e.amount, 0)
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Total Paid Amount</h3>
                  <p className="text-2xl md:text-3xl font-bold text-green-600 break-words">
                    {formatCurrency(totalPaidAmount)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Total Pending Amount</h3>
                  <p className="text-2xl md:text-3xl font-bold text-red-600 break-words">
                    {formatCurrency(totalPendingAmount)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Total Acre</h3>
                  <p className="text-2xl md:text-3xl font-bold text-blue-600 break-words">
                    {totalAcre.toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">JCB Hours</h3>
                  <p className="text-2xl md:text-3xl font-bold text-blue-600 break-words">
                    {totalJCBHours.toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">Breaker Hours</h3>
                  <p className="text-2xl md:text-3xl font-bold text-blue-600 break-words">
                    {totalBreakerHours.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Recent Rentals</h2>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => {
                          fetchRentals()
                          fetchCustomers()
                          fetchExpenses()
                        }}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 whitespace-nowrap"
                      >
                        <RefreshCw size={16} />
                        Refresh
                      </button>
                      <button
                        onClick={exportRentalsToCSV}
                        className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 whitespace-nowrap"
                      >
                        Export to CSV
                      </button>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <input
                          type="date"
                          value={rentalFilter.dateFrom}
                          onChange={(e) => setRentalFilter({...rentalFilter, dateFrom: e.target.value})}
                          className="px-3 py-1 border rounded text-sm min-w-0 flex-1 sm:flex-none"
                          placeholder="From Date"
                        />
                        <input
                          type="date"
                          value={rentalFilter.dateTo}
                          onChange={(e) => setRentalFilter({...rentalFilter, dateTo: e.target.value})}
                          className="px-3 py-1 border rounded text-sm min-w-0 flex-1 sm:flex-none"
                          placeholder="To Date"
                        />
                      </div>
                      <select
                        value={rentalFilter.machine}
                        onChange={(e) => setRentalFilter({...rentalFilter, machine: e.target.value})}
                        className="px-3 py-1 border rounded text-sm min-w-0 flex-1 sm:flex-none"
                      >
                        <option value="">All Machines</option>
                        <option value="tractor">Tractor</option>
                        <option value="harvester">Harvester</option>
                        <option value="excavator">Excavator</option>
                      </select>
                      <select
                        value={rentalFilter.paymentStatus}
                        onChange={(e) => setRentalFilter({...rentalFilter, paymentStatus: e.target.value})}
                        className="px-3 py-1 border rounded text-sm min-w-0 flex-1 sm:flex-none"
                      >
                        <option value="">All Payment Status</option>
                        <option value="UNPAID">Unpaid</option>
                        <option value="PARTIALLY_PAID">Partially Paid</option>
                        <option value="PAID">Paid</option>
                      </select>
                      <div className="relative flex-1 sm:flex-none min-w-0">
                        <input
                          type="text"
                          value={contactSearch}
                          onChange={(e) => {
                            setContactSearch(e.target.value)
                            setRentalFilter({...rentalFilter, contactNumber: e.target.value})
                            setShowContactDropdown(e.target.value.length > 0)
                          }}
                          onFocus={() => setShowContactDropdown(contactSearch.length > 0)}
                          onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                          placeholder="Contact Number"
                          className="px-3 py-1 border rounded text-sm w-full"
                        />
                        {showContactDropdown && (
                          <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-1">
                            {Array.from(new Set(customers.map(c => c.contactNumber)))
                              .filter(contact =>
                                contact && contact.toLowerCase().includes(contactSearch.toLowerCase())
                              )
                              .map((contact) => (
                                <div
                                  key={contact}
                                  className="p-2 hover:bg-gray-100 cursor-pointer"
                                  onClick={() => {
                                    setContactSearch(contact)
                                    setRentalFilter({...rentalFilter, contactNumber: contact})
                                    setShowContactDropdown(false)
                                  }}
                                >
                                  <div className="font-medium">{contact}</div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="relative flex-1 sm:flex-none min-w-0">
                        <input
                          type="text"
                          value={rentalFilter.customerSearch}
                          onChange={(e) => setRentalFilter({...rentalFilter, customerSearch: e.target.value})}
                          placeholder="Customer Name"
                          className="px-3 py-1 border rounded text-sm w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Machine</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                        <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid Amount</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Status</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pending Amount</th>
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRentals.slice((overviewPage - 1) * 10, overviewPage * 10).map((rental) => (
                        <tr key={rental.id}>
                          <td className="px-2 py-2 whitespace-nowrap text-xs">
                            {formatDateDDMMYYYY(rental.date)}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs capitalize">{rental.machineType}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs">{rental.operator.name}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs max-w-24 truncate" title={rental.customer.name}>{rental.customer.name}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs">{rental.customer.contactNumber}</td>
                          <td className="px-2 py-2 whitespace-nowrap text-xs">{rental.quantity} {rental.unitType}</td>
                          <td className="px-2 py-2 text-xs break-words max-w-24">{formatCurrency(rental.totalAmount)}</td>
                          <td className="px-2 py-2 text-xs break-words max-w-24">{formatCurrency(rental.paidAmount || 0)}</td>
                          <td className={`px-2 py-2 text-xs break-words max-w-24 ${getPaymentStatusColor(rental.paymentStatus)}`}>{rental.paymentStatus}</td>
                          <td className="px-2 py-2 text-xs break-words max-w-24">
                            {rental.paymentStatus === 'PAID' ? (
                              <span className="text-green-600">{formatCurrency(0)}</span>
                            ) : (
                              <span className="text-red-600">{formatCurrency(rental.totalAmount - (rental.paidAmount || 0))}</span>
                            )}
                          </td>
                          
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startEditRental(rental)
                                }}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPaymentRental(rental)
                                }}
                                className="text-green-600 hover:text-green-900"
                              >
                                <IndianRupee size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedRentalForBreakdown(rental)
                                }}
                                className="text-purple-600 hover:text-purple-900"
                              >
                                <BarChart3 size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (rental.billId) {
                                    setSelectedRentalsForBill([rental])
                                    setShowBillModal(true)
                                  }
                                }}
                                className={`p-1 rounded ${rental.billId ? 'text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50' : 'text-gray-400 cursor-not-allowed'}`}
                                title={rental.billId ? 'View Bill' : 'No Bill Available'}
                                disabled={!rental.billId}
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteRental(rental.id)
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-right font-semibold">Total Rentals:</td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 font-bold text-lg">
                          {formatCurrency(totalRentalsAmount)}
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {filteredRentals.length > 10 && (
                  <div className="flex items-center justify-between px-6 py-3 bg-white border-t">
                    <div className="text-sm text-gray-700">
                      Showing {Math.min((overviewPage - 1) * 10 + 1, filteredRentals.length)} to {Math.min(overviewPage * 10, filteredRentals.length)} of {filteredRentals.length} rentals
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setOverviewPage(Math.max(1, overviewPage - 1))}
                        disabled={overviewPage === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {overviewPage} of {Math.ceil(filteredRentals.length / 10)}
                      </span>
                      <button
                        onClick={() => setOverviewPage(Math.min(Math.ceil(filteredRentals.length / 10), overviewPage + 1))}
                        disabled={overviewPage === Math.ceil(filteredRentals.length / 10)}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>

          )}

          {adminActiveTab === 'add-expense' && (
            <div className="bg-white p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-semibold mb-4">Add Expense</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <input
                    type="text"
                    value={expenseDescription}
                    onChange={(e) => {
                      const value = e.target.value;
                      setExpenseDescription(value);
                      if (value.trim() !== '') {
                        setExpenseDieselCost('');
                        setExpenseMaintenanceCost('');
                        setExpenseOperatorSalary('');
                      }
                    }}
                    placeholder="Enter expense description"
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Amount</label>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border rounded-lg"
                    min="0"
                  />
                </div>
                {user.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Operator</label>
                    <select
                      value={selectedOperatorId || ''}
                      onChange={(e) => setSelectedOperatorId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="">Select Operator</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Diesel Cost (Optional)</label>
                    <input
                      type="number"
                      value={expenseDieselCost}
                      onChange={(e) => setExpenseDieselCost(e.target.value)}
                      placeholder="0"
                      className="w-full p-2 border rounded-lg"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Maintenance Cost (Optional)</label>
                    <input
                      type="number"
                      value={expenseMaintenanceCost}
                      onChange={(e) => setExpenseMaintenanceCost(e.target.value)}
                      placeholder="0"
                      className="w-full p-2 border rounded-lg"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Operator Salary (Optional)</label>
                    <input
                      type="number"
                      value={expenseOperatorSalary}
                      onChange={(e) => setExpenseOperatorSalary(e.target.value)}
                      placeholder="0"
                      className="w-full p-2 border rounded-lg"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Driver Drink Cost (Optional)</label>
                    <input
                      type="number"
                      value={expenseDriverDrinkCost}
                      onChange={(e) => setExpenseDriverDrinkCost(e.target.value)}
                      placeholder="0"
                      className="w-full p-2 border rounded-lg"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                </div>
                <button
                  onClick={saveExpense}
                  disabled={loading || (!expenseDescription && !expenseAmount && !expenseDieselCost && !expenseMaintenanceCost && !expenseOperatorSalary && !expenseDriverDrinkCost) || (user.role === 'admin' && !selectedOperatorId)}
                  className="w-full bg-green-500 text-white p-3 rounded-lg disabled:bg-gray-300"
                >
                  {loading ? 'Saving...' : 'Save Expense'}
                </button>
                <button
                  onClick={() => setExpenseDescription('jcb ' + expenseDescription)}
                  className="w-full bg-orange-500 text-white p-3 rounded-lg hover:bg-orange-600"
                >
                  JCB Expense
                </button>
              </div>
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Latest Expenses</h3>
                <div className="space-y-3">
                  {expenses.length === 0 ? (
                    <p className="text-gray-500">No expenses recorded yet.</p>
                  ) : (
                    expenses
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 3)
                      .map((expense) => (
                        <div key={expense.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-medium">{expense.description}</div>
                            <div className="font-semibold text-red-600">{formatCurrency(expense.amount)}</div>
                          </div>
                          <div className="text-sm text-gray-600">
                            <div>Operator: {expense.operator.name}</div>
                            <div>Date: {new Date(expense.date).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}

          {adminActiveTab === 'expenses' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">All Expenses</h2>
                  <div className="text-xl font-bold text-red-600">
                    Total: {formatCurrency(totalExpenses)}
                  </div>
                </div>
                <div className="flex gap-4 flex-wrap items-center">
                  <button
                    onClick={() => {
                      fetchRentals()
                      fetchCustomers()
                      fetchExpenses()
                    }}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                  <button
                    onClick={exportExpensesToCSV}
                    className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 whitespace-nowrap"
                  >
                    Export to CSV
                  </button>
                  <input
                    type="date"
                    value={expenseFilter.dateFrom}
                    onChange={(e) => setExpenseFilter({...expenseFilter, dateFrom: e.target.value})}
                    className="px-3 py-1 border rounded text-sm"
                    placeholder="From Date"
                  />
                  <input
                    type="date"
                    value={expenseFilter.dateTo}
                    onChange={(e) => setExpenseFilter({...expenseFilter, dateTo: e.target.value})}
                    className="px-3 py-1 border rounded text-sm"
                    placeholder="To Date"
                  />
                  <select
                    value={expenseFilter.category}
                    onChange={(e) => setExpenseFilter({...expenseFilter, category: e.target.value})}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    <option value="">All Categories</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Operator Salary">Operator Salary</option>
                    <option value="Driver Drink">Driver Drink</option>
                    <option value="Other">Other</option>
                  </select>
                  <select
                    value={expenseFilter.operator}
                    onChange={(e) => setExpenseFilter({...expenseFilter, operator: e.target.value})}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    <option value="">All Operators</option>
                    {Array.from(new Set(expenses.map(e => e.operator.name))).map(operator => (
                      <option key={operator} value={operator}>{operator}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 px-3 py-1 border rounded text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expenseFilter.jcbFilter}
                      onChange={(e) => setExpenseFilter({...expenseFilter, jcbFilter: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span>JCB Expenses Only</span>
                  </label>
                </div>
              </div>
              <div className="overflow-x-auto lg:overflow-x-visible">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operator</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredExpenses.slice((expensesPage - 1) * 10, expensesPage * 10).map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{expense.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{getExpenseCategory(expense)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{expense.operator.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-red-600 font-semibold">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatDateDDMMYYYY(expense.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditExpense(expense)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => deleteExpense(expense.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-right font-semibold">Total Expenses:</td>
                      <td className="px-6 py-4 whitespace-nowrap text-red-600 font-bold text-lg">
                        {formatCurrency(totalExpenses)}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {filteredExpenses.length > 10 && (
                <div className="flex items-center justify-between px-6 py-3 bg-white border-t">
                  <div className="text-sm text-gray-700">
                    Showing {Math.min((expensesPage - 1) * 10 + 1, filteredExpenses.length)} to {Math.min(expensesPage * 10, filteredExpenses.length)} of {filteredExpenses.length} expenses
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setExpensesPage(Math.max(1, expensesPage - 1))}
                      disabled={expensesPage === 1}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700">
                      Page {expensesPage} of {Math.ceil(filteredExpenses.length / 10)}
                    </span>
                    <button
                      onClick={() => setExpensesPage(Math.min(Math.ceil(filteredExpenses.length / 10), expensesPage + 1))}
                      disabled={expensesPage === Math.ceil(filteredExpenses.length / 10)}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {adminActiveTab === 'customers' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">All Customers</h2>
                  <button
                    onClick={() => {
                      fetchRentals()
                      fetchCustomers()
                      fetchExpenses()
                    }}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>
                <div className="flex gap-4 flex-wrap items-center">
                  <input
                    type="text"
                    value={customerFilter.contactNumber}
                    onChange={(e) => setCustomerFilter({...customerFilter, contactNumber: e.target.value})}
                    placeholder="Contact Number"
                    className="px-3 py-1 border rounded text-sm"
                  />
                </div>
              </div>
              <div className="overflow-x-auto lg:overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Rentals</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Rental Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.slice((customersPage - 1) * 10, customersPage * 10).map((customer) => (
                      <tr key={customer.id} onClick={() => setSelectedCustomer(customer)} className="cursor-pointer hover:bg-gray-50">
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap truncate" title={customer.name}>{customer.name}</td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap" title={customer.contactNumber}>{customer.contactNumber}</td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap truncate" title={customer.address || 'N/A'}>{customer.address || 'N/A'}</td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-green-600 font-semibold">
                          {formatCurrency(customer.totalRevenue)}
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap">{customer.totalRentals}</td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                          {customer.lastRentalDate ? new Date(customer.lastRentalDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditCustomer(customer)
                              }}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <Edit size={16} />
                            </button>
                            {/* <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteCustomer(customer.id)
                              }}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={16} />
                            </button> */}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customers.length > 10 && (
                  <div className="flex items-center justify-between px-6 py-3 bg-white border-t">
                    <div className="text-sm text-gray-700">
                      Showing {Math.min((customersPage - 1) * 10 + 1, customers.length)} to {Math.min(customersPage * 10, customers.length)} of {customers.length} customers
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCustomersPage(Math.max(1, customersPage - 1))}
                        disabled={customersPage === 1}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {customersPage} of {Math.ceil(customers.length / 10)}
                      </span>
                      <button
                        onClick={() => setCustomersPage(Math.min(Math.ceil(customers.length / 10), customersPage + 1))}
                        disabled={customersPage === Math.ceil(customers.length / 10)}
                        className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {adminActiveTab === 'bills' && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">All Bills</h2>
                  <button
                    onClick={() => {
                      fetchBills()
                    }}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto lg:overflow-x-visible">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">
                          {bill.billNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap truncate" title={bill.customer.name}>
                          {bill.customer.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {bill.customer.contactNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">
                          {formatCurrency(bill.totalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-blue-600 font-semibold">
                          {formatCurrency(bill.paidAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            bill.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            bill.status === 'PARTIALLY_PAID' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {bill.dueDate ? formatDateDDMMYYYY(bill.dueDate) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateDDMMYYYY(bill.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedRentalsForBill(bill.rentals)
                                setShowBillModal(true)
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="View Bill"
                            >
                              <FileText size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bills.length === 0 && (
                  <div className="px-6 py-8 text-center">
                    <p className="text-gray-500">No bills found. Create bills from rentals to see them here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Rental Modal */}
      {editingRental && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Edit Rental</h2>
            <div className="space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium mb-2">Machine Type</label>
                <select
                  value={editRentalData.machineType}
                  onChange={(e) => setEditRentalData({...editRentalData, machineType: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="tractor">Tractor</option>
                  <option value="harvester">Harvester</option>
                  <option value="excavator">Excavator</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Unit Type</label>
                <select
                  value={editRentalData.unitType}
                  onChange={(e) => setEditRentalData({...editRentalData, unitType: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                >
                  {(MACHINES.find(m => m.id === editRentalData.machineType)?.units || []).map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Quantity</label>
                <input
                  type="number"
                  value={editRentalData.quantity}
                  onChange={(e) => setEditRentalData({...editRentalData, quantity: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                  step="0.01"
                />
              </div>
              {editRentalData.machineType === 'excavator' && editRentalData.unitType === 'hourly' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">JCB Hourly Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Normal Hours</label>
                    <input
                      type="number"
                      value={editRentalData.normalHours}
                      className="w-full p-2 border rounded-lg bg-gray-100"
                      step="0.01"
                      min="0"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Breaker Hours</label>
                    <input
                      type="number"
                      value={editRentalData.breakerHours}
                      className="w-full p-2 border rounded-lg bg-gray-100"
                      step="0.01"
                      min="0"
                      readOnly
                    />
                  </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Normal Rate</label>
                      <input
                        type="number"
                        value={editRentalData.normalHourlyRate}
                        onChange={(e) => setEditRentalData({...editRentalData, normalHourlyRate: e.target.value})}
                        className="w-full p-2 border rounded-lg"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Breaker Rate</label>
                      <input
                        type="number"
                        value={editRentalData.breakerHourlyRate}
                        onChange={(e) => setEditRentalData({...editRentalData, breakerHourlyRate: e.target.value})}
                        className="w-full p-2 border rounded-lg"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Price Per Unit</label>
                <input
                  type="number"
                  value={editRentalData.pricePerUnit}
                  onChange={(e) => setEditRentalData({...editRentalData, pricePerUnit: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Total Amount</label>
                <input
                  type="number"
                  value={editRentalData.totalAmount}
                  readOnly
                  className="w-full p-2 border rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={editRentalData.description}
                  onChange={(e) => setEditRentalData({...editRentalData, description: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={editRentalData.date}
                  onChange={(e) => setEditRentalData({...editRentalData, date: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Customer Name</label>
                <input
                  type="text"
                  value={editRentalData.customerName}
                  onChange={(e) => setEditRentalData({...editRentalData, customerName: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Customer Contact</label>
                <input
                  type="text"
                  value={editRentalData.customerContact}
                  onChange={(e) => setEditRentalData({...editRentalData, customerContact: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Customer Address</label>
                <input
                  type="text"
                  value={editRentalData.customerAddress}
                  onChange={(e) => setEditRentalData({...editRentalData, customerAddress: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Paid Amount</label>
                <input
                  type="number"
                  value={editRentalData.paidAmount}
                  onChange={(e) => {
                    const newPaidAmount = e.target.value;
                    const paidAmountFloat = parseFloat(newPaidAmount) || 0;
                    const totalAmountFloat = parseFloat(editRentalData.totalAmount) || 0;
                    let newStatus = editRentalData.paymentStatus;
                    if (paidAmountFloat >= totalAmountFloat) {
                      newStatus = 'PAID';
                    } else if (paidAmountFloat > 0 && editRentalData.paymentStatus !== 'PAID') {
                      newStatus = 'PARTIALLY_PAID';
                    } else if (paidAmountFloat === 0) {
                      newStatus = 'UNPAID';
                    }
                    setEditRentalData({
                      ...editRentalData,
                      paidAmount: newPaidAmount,
                      paymentStatus: newStatus
                    });
                  }}
                  className="w-full p-2 border rounded-lg"
                  step="0.01"
                />
              </div>
          
              <div>
                <label className="block text-sm font-medium mb-2">Payment Mode</label>
                <select
                  value={editRentalData.paymentMode}
                  onChange={(e) => setEditRentalData({...editRentalData, paymentMode: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">Select Mode</option>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>

              
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <input
                  type="number"
                  value={editRentalData.additionalAmount}
                  onChange={(e) => setEditRentalData({...editRentalData, additionalAmount: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                  step="0.01"
                  placeholder="Additional amount"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Mode</label>
                <select
                  value={editRentalData.additionalPaymentMode}
                  onChange={(e) => setEditRentalData({...editRentalData, additionalPaymentMode: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </select>
              </div>
            </div>

                <div>
                <label className="block text-sm font-medium mb-2">Payment Status</label>
                <select
                  value={editRentalData.paymentStatus}
                  onChange={(e) => setEditRentalData({...editRentalData, paymentStatus: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="UNPAID">Unpaid</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="PAID">Paid</option>
                </select>
              </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={updateRental}
                disabled={loading}
                className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:bg-gray-300"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
              <button
                onClick={() => setEditingRental(null)}
                className="flex-1 bg-gray-500 text-white p-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Expense</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={editExpenseData.description}
                  onChange={(e) => setEditExpenseData({...editExpenseData, description: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <input
                  type="number"
                  value={editExpenseData.amount}
                  onChange={(e) => setEditExpenseData({...editExpenseData, amount: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Operator</label>
                <select
                  value={editExpenseData.operatorId}
                  onChange={(e) => setEditExpenseData({...editExpenseData, operatorId: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">Select Operator</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>{operator.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={editExpenseData.date}
                  onChange={(e) => setEditExpenseData({...editExpenseData, date: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Diesel Cost</label>
                <input
                  type="number"
                  value={editExpenseData.dieselCost}
                  onChange={(e) => setEditExpenseData({...editExpenseData, dieselCost: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Maintenance Cost</label>
                <input
                  type="number"
                  value={editExpenseData.maintenanceCost}
                  onChange={(e) => setEditExpenseData({...editExpenseData, maintenanceCost: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Operator Salary</label>
                <input
                  type="number"
                  value={editExpenseData.operatorSalary}
                  onChange={(e) => setEditExpenseData({...editExpenseData, operatorSalary: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={updateExpense}
                disabled={loading}
                className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:bg-gray-300"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
              <button
                onClick={() => setEditingExpense(null)}
                className="flex-1 bg-gray-500 text-white p-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Customer</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={editCustomerData.name}
                  onChange={(e) => setEditCustomerData({...editCustomerData, name: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Contact Number</label>
                <input
                  type="text"
                  value={editCustomerData.contactNumber}
                  onChange={(e) => {
                    const contact = e.target.value
                    setEditCustomerData({...editCustomerData, contactNumber: contact})
                    if (contact && /^\d{10}$/.test(contact)) {
                      setEditCustomerMobileError('')
                    } else if (contact) {
                      setEditCustomerMobileError('Mobile number must be exactly 10 digits.')
                    } else {
                      setEditCustomerMobileError('')
                    }
                  }}
                  className="w-full p-2 border rounded-lg"
                />
                {editCustomerMobileError && <p className="text-red-500 text-sm mt-1">{editCustomerMobileError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <input
                  type="text"
                  value={editCustomerData.address}
                  onChange={(e) => setEditCustomerData({...editCustomerData, address: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={updateCustomer}
                disabled={loading}
                className="flex-1 bg-blue-500 text-white p-2 rounded-lg disabled:bg-gray-300"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
              <button
                onClick={() => setEditingCustomer(null)}
                className="flex-1 bg-gray-500 text-white p-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Rentals Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Rentals for {selectedCustomer.name}</h2>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {rentals.filter(rental => rental.customer.contactNumber === selectedCustomer.contactNumber).length === 0 ? (
                <p className="text-gray-500 text-center py-8">No rentals found for this customer.</p>
              ) : (
                <div className="space-y-4">
                  {rentals
                    .filter(rental => rental.customer.contactNumber === selectedCustomer.contactNumber)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((rental) => (
                      <div key={rental.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div>
                            <span className="font-medium text-gray-700">Date:</span>
                            <div>{new Date(rental.date).toLocaleDateString()}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Machine:</span>
                            <div className="capitalize">{rental.machineType}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Quantity:</span>
                            <div>{rental.quantity} {rental.unitType}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Amount:</span>
                            <div className="text-green-600 font-semibold">{formatCurrency(rental.totalAmount)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                          <div>
                            <span className="font-medium text-gray-700">Operator:</span>
                            <div>{rental.operator.name}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Location:</span>
                            <div>{rental.customer.address || 'N/A'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Contact:</span>
                            <div>{rental.customer.contactNumber}</div>
                          </div>
                        </div>
                        {rental.description && (
                          <div className="mb-4">
                            <span className="font-medium text-gray-700">Description:</span>
                            <div className="mt-1">{rental.description}</div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Diesel Cost:</span>
                            <div className="text-red-600">{formatCurrency(rental.dieselCost)}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Maintenance Cost:</span>
                            <div className="text-red-600">{formatCurrency(rental.maintenanceCost)}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Operator Salary:</span>
                            <div className="text-red-600">{formatCurrency(rental.operatorSalary)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentRental && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Payment</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Customer: {paymentRental.customer.name}<br/>
                  Total Amount: {formatCurrency(paymentRental.totalAmount)}<br/>
                  Paid Amount: {formatCurrency(paymentRental.paidAmount)}<br/>
                  Pending Amount: {formatCurrency(paymentRental.totalAmount - paymentRental.paidAmount)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Amount</label>
                <input
                  type="number"
                  value={additionalAmount}
                  onChange={(e) => setAdditionalAmount(e.target.value)}
                  placeholder="Enter payment amount"
                  className="w-full p-2 border rounded-lg"
                  min="0"
                  step="0.01"
                  max={paymentRental.totalAmount - paymentRental.paidAmount}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payment Mode</label>
                <select
                  value={additionalPaymentMode}
                  onChange={(e) => setAdditionalPaymentMode(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                 
                </select>
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={addPayment}
                disabled={loading || !additionalAmount || parseFloat(additionalAmount) <= 0}
                className="flex-1 bg-green-500 text-white p-2 rounded-lg disabled:bg-gray-300"
              >
                {loading ? 'Adding...' : 'Add Payment'}
              </button>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentRental(null)
                  setAdditionalAmount('')
                  setAdditionalPaymentMode('Cash')
                }}
                className="flex-1 bg-gray-500 text-white p-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rental Breakdown Modal */}
      {selectedRentalForBreakdown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Rental Cost Breakdown</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Revenue:</span>
                <span className="font-semibold text-green-600">{formatCurrency(selectedRentalForBreakdown.totalAmount)}</span>
              </div>
              {selectedRentalForBreakdown.payments && selectedRentalForBreakdown.payments.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-2">Payment History</h3>
                  <div className="space-y-2">
                    {selectedRentalForBreakdown.payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between text-sm">
                        <span>{new Date(payment.date).toLocaleDateString()} - {payment.mode}</span>
                        <span className="font-semibold text-green-600">{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total Paid:</span>
                      <span className="text-green-600">{formatCurrency(selectedRentalForBreakdown.payments.reduce((sum, p) => sum + p.amount, 0))}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setSelectedRentalForBreakdown(null)}
                className="flex-1 bg-gray-500 text-white p-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Modal */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold">Bill Details</h2>
              <button
                onClick={() => {
                  setShowBillModal(false)
                  setSelectedRentalsForBill([])
                  setBillDetails(null)
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
        {selectedRentalsForBill.length > 0 && !selectedRentalsForBill[0].billId ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No bill exists for this rental.</p>
          </div>
        ) : billDetails ? (
          <BillComponent
            bill={billDetails}
            onClose={() => {
              setShowBillModal(false)
              setSelectedRentalsForBill([])
              setBillDetails(null)
            }}
            onPrint={() => {
              // Open bill in new window for printing to avoid modal conflicts
              const printWindow = window.open('', '_blank', 'width=800,height=600')
              if (printWindow) {
                printWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Bill - ${billDetails.billNumber}</title>
                      <style>
                        @media print {
                          body { margin: 0; }
                          .no-print { display: none; }
                        }
                        body { font-family: Arial, sans-serif; }
                      </style>
                    </head>
                    <body>
                      <div id="bill-content"></div>
                      <script>
                        // Load the bill content
                        setTimeout(() => {
                          window.print();
                          window.close();
                        }, 500);
                      </script>
                    </body>
                  </html>
                `);
                printWindow.document.close();
              }
            }}
          />
        ) : null}
      </div>
    </div>
  </div>
)}
    </>
  )
}

  // Operator view
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <img src="/rentralogo.png" alt="JD Agro & Earthmovers Logo" className="mx-auto mb-4 w-32 h-auto" />
        <div className="flex flex-row justify-between items-center mb-6 gap-2">
          <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
          <button
            onClick={() => setUser(null)}
            className="bg-red-500 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center"
          >
            <LogOut size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-1 mb-6">
          <button
            onClick={() => setActiveTab('new-rental')}
            className={`px-2 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base ${
              activeTab === 'new-rental'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            New Rental
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-2 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base ${
              activeTab === 'expenses'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Expenses
          </button>
          <button
            onClick={() => setActiveTab('rentals')}
            className={`px-2 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base ${
              activeTab === 'rentals'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Rentals
          </button>
        </div>

        {activeTab === 'new-rental' && (
          <>
            <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Add New Rental</h2>

            {/* Customer Selection */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-medium mb-3">Customer Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium mb-2">Customer Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value)
                        setCustomerSearch(e.target.value)
                        setShowCustomerDropdown(true)
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                      placeholder="Enter customer name"
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                    {showCustomerDropdown && (
                      <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {(customers || [])
                          .filter(customer =>
                            customer && (
                              (customer.name && customer.name.toLowerCase().includes(customerSearch.toLowerCase())) ||
                              (customer.address && customer.address.toLowerCase().includes(customerSearch.toLowerCase())) ||
                              (customer.contactNumber && customer.contactNumber.toLowerCase().includes(customerSearch.toLowerCase()))
                            )
                          )
                          .map((customer) => (
                            <div
                              key={customer.id}
                              className="p-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setCustomerName(customer.name)
                                setCustomerSearch(customer.name)
                                setCustomerContact(customer.contactNumber)
                                setCustomerAddress(customer.address || '')
                                setShowCustomerDropdown(false)
                              }}
                            >
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-sm text-gray-600">{customer.contactNumber}</div>
                              {customer.address && <div className="text-sm text-gray-500">{customer.address}</div>}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2"><Phone size={16} /> Contact Number</label>
                    <input
                      type="tel"
                      value={customerContact}
                      onChange={(e) => {
                        const contact = e.target.value
                        setCustomerContact(contact)
                        if (contact && /^\d{10}$/.test(contact)) {
                          setMobileError('')
                        } else if (contact) {
                          setMobileError('Mobile number must be exactly 10 digits.')
                        } else {
                          setMobileError('')
                        }
                      }}
                      placeholder="Enter contact number"
                      className="w-full p-2 border rounded-lg"
                      required
                    />
                    {mobileError && <p className="text-red-500 text-sm mt-1">{mobileError}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Address / Location</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Enter customer address or work location"
                    className="w-full p-2 border rounded-lg"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Nature of Work / Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of the work"
                className="w-full p-2 border rounded-lg"
              />
            </div>

            {/* Advance Amount */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Advance Amount (Optional)</label>
              <input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0"
                className="w-full p-2 border rounded-lg"
                min="0"
                step="0.01"
              />
            </div>

            {/* Payment Mode */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full p-2 border rounded-lg"
              >
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            {/* Date of Rental */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Date of Rental</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-2 border rounded-lg"
                required
              />
            </div>

            {/* Additional Costs */}
            {/* <div className="mb-6">
              <h3 className="text-lg font-medium mb-3">Additional Costs (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Diesel Cost</label>
                  <input
                    type="number"
                    value={dieselCost}
                    onChange={(e) => setDieselCost(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Maintenance Cost</label>
                  <input
                    type="number"
                    value={maintenanceCost}
                    onChange={(e) => setMaintenanceCost(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Operator Salary</label>
                  <input
                    type="number"
                    value={operatorSalary}
                    onChange={(e) => setOperatorSalary(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div> */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {MACHINES.map((machine) => (
                <button
                  key={machine.id}
                  onClick={() => {
                    setSelectedMachine(machine.id);
                    if (machine.id === 'harvester') {
                      setSelectedUnit('acre');
                    }
                  }}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    selectedMachine === machine.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-8 h-8 mx-auto mb-2 rounded flex items-center justify-center font-bold text-white text-lg ${
                    machine.id === 'harvester' ? 'bg-green-500' :
                    machine.id === 'excavator' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }`}>
                    {machine.name.charAt(0)}
                  </div>
                  <div className="font-medium">{machine.name}</div>
                </button>
              ))}
            </div>

            {selectedMachine && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Unit Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {MACHINES.find(m => m.id === selectedMachine)?.units.map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setSelectedUnit(unit)}
                      className={`p-2 rounded border capitalize ${
                        selectedUnit === unit
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedMachine && selectedUnit && (selectedUnit !== 'monthly' && selectedUnit !== 'work') && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium">Edit Rates</h3>
                  <button
                    onClick={() => setShowEditRates(!showEditRates)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    {showEditRates ? 'Cancel' : 'Edit Rates'}
                  </button>
                </div>
                {showEditRates && (
                  <div className="space-y-4">
                    {MACHINES.filter(machine => !selectedMachine || machine.id === selectedMachine).map((machine) => (
                      <div key={machine.id} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2 capitalize">{machine.name} Rates</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {machine.units.filter(unit => (!selectedUnit || unit === selectedUnit) && !(machine.id === 'excavator' && unit === 'hourly')).map((unit) => (
                            <div key={unit}>
                              <label className="block text-sm font-medium mb-1 capitalize">{unit}</label>
                              <input
                                type="number"
                                value={prices[machine.id as keyof typeof prices][unit as keyof typeof prices[keyof typeof prices]]}
                                onChange={(e) => {
                                  const newPrices = { ...prices }
                                  const newValue = parseInt(e.target.value) || 0
                                  newPrices[machine.id as keyof typeof prices][unit as keyof typeof prices[keyof typeof prices]] = newValue
                                  if (machine.id === 'harvester' && unit === 'acre') {
                                    newPrices.harvester.guntha = Math.round(newValue / 40)
                                  }
                                  setPrices(newPrices)
                                }}
                                className="w-full p-2 border rounded"
                                min="0"
                              />
                            </div>
                          ))}
                        </div>
                        {machine.id === 'excavator' && selectedUnit === 'hourly' && (
                          <div className="mt-4 space-y-4">
                            <h5 className="font-medium mb-2">JCB Hourly Rates</h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1">Normal Hourly Rate</label>
                                <input
                                  type="number"
                                  value={normalHourlyRate}
                                  onChange={(e) => {
                                    setNormalHourlyRate(e.target.value)
                                    // Recalculate all time slots
                                    const newSlots = timeSlots.map(slot => ({
                                      ...slot,
                                      calculatedAmount: calculateHours(slot.start, slot.end) * (slot.isBreaker ? (parseFloat(breakerHourlyRate) || 0) : parseFloat(e.target.value) || 0)
                                    }))
                                    setTimeSlots(newSlots)
                                  }}
                                  className="w-full p-2 border rounded"
                                  min="0"
                                  placeholder="Normal rate"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1">Breaker Hourly Rate</label>
                                <input
                                  type="number"
                                  value={breakerHourlyRate}
                                  onChange={(e) => {
                                    setBreakerHourlyRate(e.target.value)
                                    // Recalculate all time slots
                                    const newSlots = timeSlots.map(slot => ({
                                      ...slot,
                                      calculatedAmount: calculateHours(slot.start, slot.end) * (slot.isBreaker ? parseFloat(e.target.value) || 0 : (parseFloat(normalHourlyRate) || 0))
                                    }))
                                    setTimeSlots(newSlots)
                                  }}
                                  className="w-full p-2 border rounded"
                                  min="0"
                                  placeholder="Breaker rate"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedUnit && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {selectedUnit === 'hourly' ? 'Time Selection' : (selectedUnit === 'monthly' || selectedUnit === 'work') ? 'Amount' : 'Quantity'}
                </label>
                {(selectedUnit === 'monthly' || selectedUnit === 'work') ? (
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full p-2 border rounded-lg"
                  />
                ) : (selectedUnit === 'acre' || selectedUnit === 'guntha') ? (
                  <input
                    type="text"
                    value={quantityText}
                    onChange={(e) => {
                      setQuantityText(e.target.value);
                      const parsed = parseQuantity(e.target.value, selectedUnit);
                      setQuantity(parsed);
                    }}
                    placeholder={`Enter quantity (e.g., 1.45 or 2 acre 35 guntha)`}
                    className="w-full p-2 border rounded-lg"
                  />
                ) : selectedUnit === 'hourly' ? (
                  <div>
                    {timeSlots.map((slot, index) => (
                      <div key={index} className="border rounded-lg p-3 mb-2 bg-gray-50">
                        <div className="space-y-4 mb-2">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium">Start Time</label>
                              <button
                                onClick={() => setCurrentTime(index, 'start')}
                                className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600"
                                title="Set current time"
                              >
                                Now
                              </button>
                            </div>
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateTimeSlot(index, 'start', e.target.value)}
                              className="w-full p-4 border rounded-lg text-xl"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium">End Time</label>
                              <button
                                onClick={() => setCurrentTime(index, 'end')}
                                className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600"
                                title="Set current time"
                              >
                                Now
                              </button>
                            </div>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateTimeSlot(index, 'end', e.target.value)}
                              className="w-full p-4 border rounded-lg text-xl"
                            />
                          </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-blue-800 text-center">
                          {calculateHours(slot.start, slot.end).toFixed(2)} hrs
                        </div>
                        <div className="flex justify-center gap-2 mt-2">
                          <button
                            onClick={() => updateTimeSlotType(index, false)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              !slot.isBreaker
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            Normal
                          </button>
                          <button
                            onClick={() => updateTimeSlotType(index, true)}
                            className={`px-3 py-1 rounded text-sm font-medium ${
                              slot.isBreaker
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            Breaker
                          </button>
                          {timeSlots.length > 1 && (
                            <button
                              onClick={() => removeTimeSlot(index)}
                              className="bg-red-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-600"
                              title="Remove time slot"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="space-y-2">
                      {selectedMachine === 'excavator' && selectedUnit === 'hourly' ? (
                        <>
                          <div className="text-lg font-semibold text-center p-2 bg-blue-50 rounded-lg">
                            JCB Hours: {timeSlots.filter(s => !s.isBreaker).reduce((sum, s) => sum + calculateHours(s.start, s.end), 0).toFixed(2)} hrs
                          </div>
                          <div className="text-lg font-semibold text-center p-2 bg-orange-50 rounded-lg">
                            Breaker Hours: {timeSlots.filter(s => s.isBreaker).reduce((sum, s) => sum + calculateHours(s.start, s.end), 0).toFixed(2)} hrs
                          </div>
                          <div className="text-lg font-semibold text-center p-2 bg-blue-50 rounded-lg">
                            Total Hours: {quantity.toFixed(2)} hrs
                          </div>
                        </>
                      ) : (
                        <div className="text-lg font-semibold text-center p-2 bg-blue-50 rounded-lg">
                          Total Hours: {quantity.toFixed(2)} hrs
                        </div>
                      )}
                      <div className="text-lg font-semibold text-center p-2 bg-green-50 rounded-lg">
                        Total Amount: {selectedMachine === 'excavator' && selectedUnit === 'hourly' ? formatCurrency(timeSlots.reduce((sum, slot) => sum + slot.calculatedAmount, 0)) : formatCurrency(quantity * prices[selectedMachine as keyof typeof prices][selectedUnit as keyof typeof prices[keyof typeof prices]])}
                      </div>
                    </div>
                    <button
                      onClick={addTimeSlot}
                      className="bg-blue-500 text-white px-3 py-2 rounded text-sm mt-2"
                    >
                      Add Time Slot
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center"
                    >
                      <Minus size={20} />
                    </button>
                    {selectedUnit === 'trip' ? (
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 p-2 border rounded-lg text-center text-2xl font-bold"
                        min="1"
                      />
                    ) : (
                      <span className="text-2xl font-bold w-16 text-center">{quantity}</span>
                    )}
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                )}

              </div>
            )}

            {selectedMachine && selectedUnit && !(selectedMachine === 'excavator' && selectedUnit === 'hourly') && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                {selectedUnit !== 'monthly' && selectedUnit !== 'work' && (
                  <div className="flex justify-between items-center">
                    <span>Rate per {selectedUnit}:</span>
                    <span className="font-semibold">
                      {formatCurrency(prices[selectedMachine as keyof typeof prices][selectedUnit as keyof typeof prices[keyof typeof prices]])}
                    </span>
                  </div>
                )}
                {selectedUnit === 'hourly' && (
                  <div className="flex justify-between items-center">
                    <span>Total Hours:</span>
                    <span className="font-semibold">
                      {quantity.toFixed(2)} hrs
                    </span>
                  </div>
                )}
                {(selectedUnit === 'monthly' || selectedUnit === 'work') ? (
                  <div className="flex justify-between items-center mt-2">
                    <span>Amount:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(parseFloat(amount) || 0)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center mt-2">
                    <span>Total Amount:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(quantity * prices[selectedMachine as keyof typeof prices][selectedUnit as keyof typeof prices[keyof typeof prices]])}
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={createRental}
              disabled={!selectedMachine || !selectedUnit || !customerName || !customerContact || !customerAddress || loading}
              className="w-full bg-green-500 text-white p-3 rounded-lg disabled:bg-gray-300"
            >
              {loading ? 'Adding...' : 'Add Rental Entry'}
            </button>

            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>

          {/* Recent Rentals */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4">Your Last 3 Rentals</h3>
            <div className="space-y-3">
              {rentals
                .filter(r => r.operator.name === user.name)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map((rental) => (
                  <div key={rental.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium capitalize">{rental.machineType}</div>
                      <div className="font-semibold text-green-600">{formatCurrency(rental.totalAmount)}</div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Customer: {rental.customer.name} ({rental.customer.contactNumber})</div>
                      <div>Location: {rental.customer.address || 'N/A'}</div>
                      <div>Date: {new Date(rental.date).toLocaleDateString()}</div>
                      <div>Quantity: {rental.quantity} {rental.unitType}</div>
                      {rental.description && <div>Description: {rental.description}</div>}
                      <div className="flex justify-between pt-2 border-t">
                        <span>Paid: <span className="text-green-600 font-medium">{formatCurrency(rental.paidAmount || 0)}</span></span>
                        <span>Pending: <span className="text-red-600 font-medium">{formatCurrency(rental.totalAmount - (rental.paidAmount || 0))}</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              {rentals.filter(r => r.operator.name === user.name).length === 0 && (
                <p className="text-gray-500 text-center py-4">No rentals recorded yet.</p>
              )}
            </div>
          </div>
          </>

        )}

        {activeTab === 'expenses' && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">Add Expense</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => {
                    const value = e.target.value;
                    setExpenseDescription(value);
                    if (value.trim() !== '') {
                      setExpenseDieselCost('');
                      setExpenseMaintenanceCost('');
                      setExpenseOperatorSalary('');
                    }
                  }}
                  placeholder="Enter expense description"
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  className="w-full p-2 border rounded-lg"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Operator</label>
                <select
                  value={selectedOperatorId || ''}
                  onChange={(e) => setSelectedOperatorId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">Select Operator</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>{operator.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Diesel Cost (Optional)</label>
                  <input
                    type="number"
                    value={expenseDieselCost}
                    onChange={(e) => setExpenseDieselCost(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border rounded-lg"
                    min="0"
                    disabled={expenseDescription.trim() !== ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Maintenance Cost (Optional)</label>
                  <input
                    type="number"
                    value={expenseMaintenanceCost}
                    onChange={(e) => setExpenseMaintenanceCost(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border rounded-lg"
                    min="0"
                    disabled={expenseDescription.trim() !== ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Operator Salary (Optional)</label>
                  <input
                    type="number"
                    value={expenseOperatorSalary}
                    onChange={(e) => setExpenseOperatorSalary(e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border rounded-lg"
                    min="0"
                    disabled={expenseDescription.trim() !== ''}
                  />
                </div>
              </div>
              <button
                onClick={saveExpense}
                disabled={loading || (!selectedOperatorId) || (!expenseDescription && !expenseAmount && !expenseDieselCost && !expenseMaintenanceCost && !expenseOperatorSalary)}
                className="w-full bg-green-500 text-white p-3 rounded-lg disabled:bg-gray-300"
              >
                {loading ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4">Latest Expenses</h3>
              <div className="space-y-3">
                {expenses.length === 0 ? (
                  <p className="text-gray-500">No expenses recorded yet.</p>
                ) : (
                  expenses
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 3)
                    .map((expense) => (
                      <div key={expense.id} className="p-4 bg-gray-50 rounded-lg">
                       <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">{expense.description}</div>
                          <div className="font-semibold text-red-600">{formatCurrency(expense.amount)}</div>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>Operator: {expense.operator.name}</div>
                          <div>Date: {new Date(expense.date).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rentals' && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Your Recent Rentals</h2>
            <div className="space-y-3">
              {rentals
                .filter(r => r.operator.name === user.name)
                .slice(0, 5)
                .map((rental) => (
                  <div key={rental.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium capitalize">{rental.machineType}</div>
                      <div className="font-semibold text-green-600">{formatCurrency(rental.totalAmount)}</div>
                    </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Customer: {rental.customer.name} ({rental.customer.contactNumber})</div>
              <div>Location: {rental.customer.address || 'N/A'}</div>
              <div>Date: {new Date(rental.date).toLocaleDateString()}</div>
              {rental.machineType === 'excavator' && rental.unitType === 'hourly' ? (() => {
                let slots = rental.timeSlots;
                if (typeof slots === 'string') {
                  try {
                    slots = JSON.parse(slots);
                  } catch (e) {
                    slots = [];
                  }
                }
                if (Array.isArray(slots)) {
                  const getStartEnd = (slot: any) => {
  const start = slot.startTime ?? slot.start;
  const end = slot.endTime ?? slot.end;

  if (!start || !end) return null;

  return { start, end };
};
                  const jcbHours = slots
  .filter(slot => !slot.isBreaker)
  .reduce((sum, slot) => {
    const times = getStartEnd(slot);
    if (!times) return sum;
    return sum + calculateHours(times.start, times.end);
  }, 0);

const breakerHours = slots
  .filter(slot => slot.isBreaker)
  .reduce((sum, slot) => {
    const times = getStartEnd(slot);
    if (!times) return sum;
    return sum + calculateHours(times.start, times.end);
  }, 0);
                  return (
                    <div>
                      JCB: {jcbHours.toFixed(2)} hr @ ₹{rental.normalHourlyRate}
                      <br />
                      Breaker: {breakerHours.toFixed(2)} hr @ ₹{rental.breakerHourlyRate}
                    </div>
                  );
                }
                return <div>Quantity: {rental.quantity} {rental.unitType}</div>;
              })() : (
                <div>Quantity: {rental.quantity} {rental.unitType}</div>
              )}
              <div className="flex justify-between">
              {(rental as any).description && <div>Description: {(rental as any).description}</div>}
                <span>Paid: <span className="text-green-600 font-medium">{formatCurrency(rental.paidAmount || 0)}</span></span>
                <span>Pending: <span className="text-red-600 font-medium">{formatCurrency(rental.totalAmount - (rental.paidAmount || 0))}</span></span>
              </div>
            </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
