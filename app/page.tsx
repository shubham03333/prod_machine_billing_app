"use client"

import { useState, useEffect } from 'react'
import { Minus, LogIn, BarChart3, Trash2, Plus, RefreshCw, Edit, LogOut, FileText, Users, Phone, Fuel, Clock, User, Wrench, IndianRupee, Truck, MapPin, Calendar, CreditCard, CheckCircle2, Wallet, Receipt, Leaf, Download, LayoutDashboard, TrendingUp, TrendingDown } from 'lucide-react'
import { StatsChart } from '../components/StatsChart'
import BillComponent from '../components/BillComponent'
import { canAccessAdminDashboard, canEditAdminData, isReadOnlyAdmin } from '@/lib/roles'
import { STANDARD_PRICES } from '@/lib/prices'
import { FIELD_SESSION_KEY } from '@/lib/gps/constants'
import FieldOperatorsAdmin from '@/components/gps/FieldOperatorsAdmin'
import GpsMeasurementsAdmin from '@/components/gps/GpsMeasurementsAdmin'

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
  pin?: string
  canEditAdmin?: boolean
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
  gpsMeasurementId?: number | null
  gpsMeasurement?: { village?: string | null } | null
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

function rentalVillage(rental: { gpsMeasurement?: { village?: string | null } | null; customer?: { address?: string | null } }) {
  return (rental.gpsMeasurement?.village || rental.customer?.address || '').trim()
}

export default function Home() {
  const [pin, setPin] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [loginMode, setLoginMode] = useState<'staff' | 'field'>('staff')

  // Load user from localStorage on mount
  useEffect(() => {
    const fieldRaw = localStorage.getItem(FIELD_SESSION_KEY)
    if (fieldRaw) {
      window.location.href = '/field'
      return
    }
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        if (parsedUser.role === 'field_operator') {
          localStorage.removeItem('user')
          return
        }
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
  const [successMessage, setSuccessMessage] = useState('')
  const [operatorRentalsShown, setOperatorRentalsShown] = useState(5)
  const [operatorRentalSearch, setOperatorRentalSearch] = useState('')
  const [mobileError, setMobileError] = useState('')
  const [filter, setFilter] = useState('today')
  const [prices, setPrices] = useState(STANDARD_PRICES)
  const [showEditRates, setShowEditRates] = useState(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'new-rental' | 'expenses' | 'rentals'>('new-rental')
  const [selectedRentalId, setSelectedRentalId] = useState<number | null>(null)
  const [adminActiveTab, setAdminActiveTab] = useState<'overview' | 'add-expense' | 'expenses' | 'customers' | 'bills' | 'field-ops' | 'gps'>('overview')
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
  const [showDeleteRentalModal, setShowDeleteRentalModal] = useState(false)
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false)
  const [rentalToDelete, setRentalToDelete] = useState<Rental | null>(null)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
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
          const res = await fetch(`/api/bills/${selectedRentalsForBill[0].billId}`, {
            headers: { 'x-user-pin': user?.pin || '' },
          })
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
      if (user.role === 'operator') {
        setSelectedOperatorId(user.id)
      }
    }
  }, [user])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

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

  const fieldLogin = async () => {
    if (!pin) return
    setLoading(true)
    try {
      const res = await fetch('/api/field-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem(FIELD_SESSION_KEY, JSON.stringify(data))
        window.location.href = '/field'
      } else {
        setError(data.error)
      }
    } catch {
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
    if (!res.ok) {
      throw new Error('Failed to fetch expenses')
    }
    const data = await res.json()
    setExpenses(Array.isArray(data) ? data : [])
  } catch (err) {
    console.error('Failed to fetch expenses')
    setExpenses([])
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
    const res = await fetch('/api/bills', {
      headers: { 'x-user-pin': user?.pin || '' },
    })
    const data = await res.json()
    setBills(Array.isArray(data.bills) ? data.bills : [])
  } catch (err) {
    console.error('Failed to fetch bills')
    setBills([])
  }
}

  const saveExpense = async () => {
    if (!user) return
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

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
        headers: {'Content-Type': 'application/json', 'x-user-pin': user?.pin || ''},
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
        setSelectedOperatorId(user.role === 'operator' ? user.id : null)
        setError('')
        setSuccessMessage('Expense saved')
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
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

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
        headers: {'Content-Type': 'application/json', 'x-user-pin': user?.pin || ''},
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
        setSuccessMessage('Rental saved')
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
    const rental = rentals.find(r => r.id === id)
    if (rental) {
      setRentalToDelete(rental)
      setShowDeleteRentalModal(true)
    }
  }

  const confirmDeleteRental = async () => {
    if (!rentalToDelete) return
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

    try {
      await fetch(`/api/rentals/${rentalToDelete.id}`, {method: 'DELETE', headers: {'x-user-pin': user?.pin || ''}})
      fetchRentals()
      setShowDeleteRentalModal(false)
      setRentalToDelete(null)
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
      customerAddress: rentalVillage(rental),
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
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/rentals/${editingRental.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', 'x-user-pin': user?.pin || ''},
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
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', 'x-user-pin': user?.pin || ''},
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
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/expenses/${editingExpense.id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json', 'x-user-pin': user?.pin || ''},
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
    const expense = expenses.find(e => e.id === id)
    if (expense) {
      setExpenseToDelete(expense)
      setShowDeleteExpenseModal(true)
    }
  }

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

    try {
      await fetch(`/api/expenses/${expenseToDelete.id}`, {method: 'DELETE', headers: {'x-user-pin': user?.pin || ''}})
      fetchExpenses()
      setShowDeleteExpenseModal(false)
      setExpenseToDelete(null)
    } catch (err) {
      console.error('Failed to delete expense')
    }
  }

  const deleteCustomer = async (id: number) => {
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }
    if (!confirm('Are you sure you want to delete this customer?')) return

    try {
      await fetch(`/api/customers/${id}`, {method: 'DELETE', headers: {'x-user-pin': user?.pin || ''}})
      fetchCustomers()
    } catch (err) {
      console.error('Failed to delete customer')
    }
  }

  const addPayment = async () => {
    if (!paymentRental || !additionalAmount || !additionalPaymentMode) return
    if (isReadOnlyAdmin(user)) {
      setError('Read-only admin cannot add or edit data')
      return
    }

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
      rentalVillage(r) || '',
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
      <div className="min-h-screen bg-white flex items-center justify-center px-4 overflow-x-hidden">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-md min-w-0">
        <img src="/rentralogo.png" alt="JD Agro & Earthmovers Logo" className="mx-auto mb-4 w-32 h-auto" />
        <h1 className="text-2xl font-bold text-center mb-6">🚜 JD Agro & Earthmovers</h1>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button type="button" onClick={() => { setLoginMode('staff'); setError('') }} className={`p-2 rounded-lg text-sm ${loginMode === 'staff' ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}>Staff</button>
          <button type="button" onClick={() => { setLoginMode('field'); setError('') }} className={`p-2 rounded-lg text-sm ${loginMode === 'field' ? 'bg-slate-900 text-white' : 'bg-gray-100'}`}>Field Operator</button>
        </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (loginMode === 'field') fieldLogin()
              else login()
            }}
          >
            <input
              type="password"
              placeholder={loginMode === 'field' ? '4 or 6 digit PIN' : 'Enter PIN'}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, loginMode === 'field' ? 6 : 10))}
              className="w-full p-3 border rounded-lg text-center text-2xl text-black"
              inputMode="numeric"
              maxLength={loginMode === 'field' ? 6 : 10}
              autoComplete="current-password"
              enterKeyHint="go"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white p-3 rounded-lg flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              {loading ? 'Logging in...' : 'Login'}
            </button>
            {error && <p className="text-red-500 text-center">{error}</p>}
          </form>
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

  const filteredExpenses = (Array.isArray(expenses) ? expenses : [])
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

  const filteredCustomers = (Array.isArray(customers) ? customers : [])
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

  const canEdit = canEditAdminData(user)
  const showAdminDashboard =
    user.role === 'admin' ||
    user.role === 'readonly_admin' ||
    user.pin === '9823' ||
    canAccessAdminDashboard(user)

if (showAdminDashboard) {
  const totalRevenueAll = rentals.reduce((sum, r) => sum + r.totalAmount, 0)
  const totalExpensesAll = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netProfitAll = totalRevenueAll - totalExpensesAll
  const adminTabs = [
    { id: 'overview' as const, label: 'Overview', Icon: LayoutDashboard, show: true },
    { id: 'add-expense' as const, label: 'Add Expense', Icon: Plus, show: canEdit },
    { id: 'expenses' as const, label: 'Expenses', Icon: Wallet, show: true },
    { id: 'customers' as const, label: 'Customers', Icon: Users, show: true },
    { id: 'bills' as const, label: 'Bills', Icon: Receipt, show: true },
    { id: 'field-ops' as const, label: 'Field Ops', Icon: User, show: canEdit },
    { id: 'gps' as const, label: 'GPS Fields', Icon: MapPin, show: true },
  ]

  return (
    <>
      <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src="/rentralogo.png" alt="JD Agro & Earthmovers" className="h-10 w-10 object-contain shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">JD Agro & Earthmovers</p>
                <h1 className="text-lg sm:text-xl font-semibold truncate">
                  {canEdit ? 'Operations Dashboard' : 'Read-only Dashboard'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-800">{user.name}</span>
                <span className="text-[11px] text-slate-500">{canEdit ? 'Administrator' : 'Read-only admin'}</span>
              </div>
              <button
                onClick={() => setUser(null)}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-sm"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </div>
          <div className="max-w-7xl mx-auto px-4 pb-3">
            <nav className="flex gap-1 overflow-x-auto pb-1">
              {adminTabs.filter(tab => tab.show).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAdminActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    adminActiveTab === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <tab.Icon size={16} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
            {!canEdit && (
                <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
                    You are in <strong>read-only</strong> mode. You can view data and export CSVs, but you cannot add, edit, or delete records.
                </div>
            )}

          {adminActiveTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-500 truncate">Total Revenue</h3>
                    <span className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><TrendingUp size={18} /></span>
                  </div>
                  <p className="dash-metric text-2xl sm:text-3xl font-semibold text-slate-900">
                    {formatCurrency(totalRevenueAll)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-500 truncate">Total Expenses</h3>
                    <span className="h-9 w-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><TrendingDown size={18} /></span>
                  </div>
                  <p className="dash-metric text-2xl sm:text-3xl font-semibold text-slate-900">
                    {formatCurrency(totalExpensesAll)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-slate-500 truncate">Net Profit</h3>
                    <span className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><IndianRupee size={18} /></span>
                  </div>
                  <p className={`dash-metric text-2xl sm:text-3xl font-semibold ${netProfitAll >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    {formatCurrency(netProfitAll)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <h3 className="text-xs font-medium text-slate-500 mb-1 whitespace-nowrap">Paid</h3>
                  <p className="dash-metric text-lg font-semibold text-emerald-700">
                    {formatCurrency(totalPaidAmount)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <h3 className="text-xs font-medium text-slate-500 mb-1 whitespace-nowrap">Pending</h3>
                  <p className="dash-metric text-lg font-semibold text-rose-700">
                    {formatCurrency(totalPendingAmount)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <h3 className="text-xs font-medium text-slate-500 mb-1 whitespace-nowrap">Total Acre</h3>
                  <p className="dash-metric text-lg font-semibold text-slate-900">
                    {totalAcre.toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                  <h3 className="text-xs font-medium text-slate-500 mb-1 whitespace-nowrap">JCB Hours</h3>
                  <p className="dash-metric text-lg font-semibold text-slate-900">
                    {totalJCBHours.toFixed(2)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0 sm:col-span-2 xl:col-span-1">
                  <h3 className="text-xs font-medium text-slate-500 mb-1 whitespace-nowrap">Breaker Hours</h3>
                  <p className="dash-metric text-lg font-semibold text-slate-900">
                    {totalBreakerHours.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100">
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900">Recent Rentals</h2>
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => {
                          fetchRentals()
                          fetchCustomers()
                          fetchExpenses()
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 whitespace-nowrap"
                      >
                        <RefreshCw size={16} />
                        Refresh
                      </button>
                      <button
                        onClick={exportRentalsToCSV}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 whitespace-nowrap"
                      >
                        <Download size={16} />
                        Export CSV
                      </button>
                    </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="date"
                          value={rentalFilter.dateFrom}
                          onChange={(e) => setRentalFilter({...rentalFilter, dateFrom: e.target.value})}
                          className="dash-input flex-1 sm:flex-none"
                          placeholder="From Date"
                        />
                        <input
                          type="date"
                          value={rentalFilter.dateTo}
                          onChange={(e) => setRentalFilter({...rentalFilter, dateTo: e.target.value})}
                          className="dash-input flex-1 sm:flex-none"
                          placeholder="To Date"
                        />
                      <select
                        value={rentalFilter.machine}
                        onChange={(e) => setRentalFilter({...rentalFilter, machine: e.target.value})}
                        className="dash-input flex-1 sm:flex-none"
                      >
                        <option value="">All Machines</option>
                        <option value="tractor">Tractor</option>
                        <option value="harvester">Harvester</option>
                        <option value="excavator">Excavator</option>
                      </select>
                      <select
                        value={rentalFilter.paymentStatus}
                        onChange={(e) => setRentalFilter({...rentalFilter, paymentStatus: e.target.value})}
                        className="dash-input flex-1 sm:flex-none"
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
                          className="dash-input w-full"
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
                          className="dash-input w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Machine</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Operator</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paid</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending</th>
                        <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filteredRentals.slice((overviewPage - 1) * 10, overviewPage * 10).map((rental) => (
                        <tr key={rental.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-700">
                            {formatDateDDMMYYYY(rental.date)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm capitalize">{rental.machineType}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm">{rental.operator.name}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm max-w-[8rem] truncate" title={rental.customer.name}>{rental.customer.name}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm">{rental.customer.contactNumber}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm">{rental.quantity} {rental.unitType}</td>
                          <td className="px-3 py-3 text-sm font-medium">{formatCurrency(rental.totalAmount)}</td>
                          <td className="px-3 py-3 text-sm">{formatCurrency(rental.paidAmount || 0)}</td>
                          <td className="px-3 py-3 text-sm">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              rental.paymentStatus === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                              rental.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700' :
                              'bg-rose-50 text-rose-700'
                            }`}>{rental.paymentStatus}</span>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {rental.paymentStatus === 'PAID' ? (
                              <span className="text-emerald-700">{formatCurrency(0)}</span>
                            ) : (
                              <span className="text-rose-700">{formatCurrency(rental.totalAmount - (rental.paidAmount || 0))}</span>
                            )}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex gap-1">
                              {canEdit && (
                                  <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        startEditRental(rental)
                                      }}
                                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                                  >
                                    <Edit size={14}/>
                                  </button>
                              )}
                              {canEdit && (
                                  <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setPaymentRental(rental)
                                      }}
                                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                                  >
                                    <IndianRupee size={14}/>
                                  </button>
                              )}
                              <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedRentalForBreakdown(rental)
                                  }}
                                  className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50"
                              >
                                <BarChart3 size={14}/>
                              </button>
                              <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (rental.billId) {
                                      setSelectedRentalsForBill([rental])
                                      setShowBillModal(true)
                                    }
                                  }}
                                  className={`p-1.5 rounded-lg ${rental.billId ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-300 cursor-not-allowed'}`}
                                  title={rental.billId ? 'View Bill' : 'No Bill Available'}
                                  disabled={!rental.billId}
                              >
                                <FileText size={14}/>
                              </button>
                              {canEdit && (
                                  <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteRental(rental.id)
                                      }}
                                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 size={14}/>
                                  </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right text-sm font-medium text-slate-600">Filtered total</td>
                        <td className="px-4 py-3 whitespace-nowrap text-emerald-700 font-semibold">
                          {formatCurrency(totalRentalsAmount)}
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {filteredRentals.length > 10 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-50/80 border-t border-slate-100">
                    <div className="text-sm text-slate-600">
                      Showing {Math.min((overviewPage - 1) * 10 + 1, filteredRentals.length)} to {Math.min(overviewPage * 10, filteredRentals.length)} of {filteredRentals.length} rentals
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setOverviewPage(Math.max(1, overviewPage - 1))}
                        disabled={overviewPage === 1}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {overviewPage} of {Math.ceil(filteredRentals.length / 10)}
                      </span>
                      <button
                        onClick={() => setOverviewPage(Math.min(Math.ceil(filteredRentals.length / 10), overviewPage + 1))}
                        disabled={overviewPage === Math.ceil(filteredRentals.length / 10)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
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
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
              <h2 className="text-lg font-semibold mb-1 text-slate-900">Add Expense</h2>
              <p className="text-sm text-slate-500 mb-5">Record diesel, maintenance, salary, or other costs.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Description</label>
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
                    className="dash-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Amount</label>
                  <input
                    type="number"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0"
                    className="dash-input w-full"
                    min="0"
                  />
                </div>
                {user.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700">Operator</label>
                    <select
                      value={selectedOperatorId || ''}
                      onChange={(e) => setSelectedOperatorId(e.target.value ? parseInt(e.target.value) : null)}
                      className="dash-input w-full"
                    >
                      <option value="">Select Operator</option>
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>{op.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-slate-700">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="dash-input w-full"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700">Diesel Cost (Optional)</label>
                    <input
                      type="number"
                      value={expenseDieselCost}
                      onChange={(e) => setExpenseDieselCost(e.target.value)}
                      placeholder="0"
                      className="dash-input w-full disabled:bg-slate-50 disabled:text-slate-400"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700">Maintenance Cost (Optional)</label>
                    <input
                      type="number"
                      value={expenseMaintenanceCost}
                      onChange={(e) => setExpenseMaintenanceCost(e.target.value)}
                      placeholder="0"
                      className="dash-input w-full disabled:bg-slate-50 disabled:text-slate-400"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700">Operator Salary (Optional)</label>
                    <input
                      type="number"
                      value={expenseOperatorSalary}
                      onChange={(e) => setExpenseOperatorSalary(e.target.value)}
                      placeholder="0"
                      className="dash-input w-full disabled:bg-slate-50 disabled:text-slate-400"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700">Driver Drink Cost (Optional)</label>
                    <input
                      type="number"
                      value={expenseDriverDrinkCost}
                      onChange={(e) => setExpenseDriverDrinkCost(e.target.value)}
                      placeholder="0"
                      className="dash-input w-full disabled:bg-slate-50 disabled:text-slate-400"
                      min="0"
                      disabled={expenseDescription.trim() !== ''}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={saveExpense}
                  disabled={loading || (!expenseDescription && !expenseAmount && !expenseDieselCost && !expenseMaintenanceCost && !expenseOperatorSalary && !expenseDriverDrinkCost) || (user.role === 'admin' && !selectedOperatorId)}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Saving...' : 'Save Expense'}
                </button>
                <button
                  onClick={() => setExpenseDescription('jcb ' + expenseDescription)}
                  className="sm:w-auto bg-amber-500 text-white px-4 p-3 rounded-lg hover:bg-amber-600 font-medium"
                >
                  JCB Expense
                </button>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-100">
                <h3 className="text-base font-semibold mb-3 text-slate-900">Latest Expenses</h3>
                <div className="space-y-3">
                  {expenses.length === 0 ? (
                    <p className="text-slate-500 text-sm">No expenses recorded yet.</p>
                  ) : (
                    expenses
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 3)
                      .map((expense) => (
                        <div key={expense.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2 gap-3">
                            <div className="font-medium text-slate-900">{expense.description}</div>
                            <div className="font-semibold text-rose-700 shrink-0">{formatCurrency(expense.amount)}</div>
                          </div>
                          <div className="text-sm text-slate-500">
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100">
                <div className="flex justify-between items-center mb-4 gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">All Expenses</h2>
                  <div className="text-sm sm:text-base font-semibold text-rose-700">
                    Total: {formatCurrency(totalExpenses)}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <button
                    onClick={() => {
                      fetchRentals()
                      fetchCustomers()
                      fetchExpenses()
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                  <button
                    onClick={exportExpensesToCSV}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 whitespace-nowrap"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                  <input
                    type="date"
                    value={expenseFilter.dateFrom}
                    onChange={(e) => setExpenseFilter({...expenseFilter, dateFrom: e.target.value})}
                    className="dash-input"
                    placeholder="From Date"
                  />
                  <input
                    type="date"
                    value={expenseFilter.dateTo}
                    onChange={(e) => setExpenseFilter({...expenseFilter, dateTo: e.target.value})}
                    className="dash-input"
                    placeholder="To Date"
                  />
                  <select
                    value={expenseFilter.category}
                    onChange={(e) => setExpenseFilter({...expenseFilter, category: e.target.value})}
                    className="dash-input"
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
                    className="dash-input"
                  >
                    <option value="">All Operators</option>
                    {Array.from(new Set(expenses.map(e => e.operator.name))).map(operator => (
                      <option key={operator} value={operator}>{operator}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm cursor-pointer bg-white">
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
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Operator</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredExpenses.slice((expensesPage - 1) * 10, expensesPage * 10).map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-3 whitespace-nowrap text-sm">{expense.description}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">{getExpenseCategory(expense)}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm">{expense.operator.name}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-rose-700 font-semibold">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-700">
                          {formatDateDDMMYYYY(expense.date)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {canEdit && (
                              <div className="flex gap-1">
                                <button
                                    onClick={() => startEditExpense(expense)}
                                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                                >
                                  <Edit size={16}/>
                                </button>
                                <button
                                    onClick={() => deleteExpense(expense.id)}
                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 size={16}/>
                                </button>
                              </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={3} className="px-3 py-3 text-right text-sm font-medium text-slate-600">Total Expenses</td>
                      <td className="px-3 py-3 whitespace-nowrap text-rose-700 font-semibold">
                        {formatCurrency(totalExpenses)}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {filteredExpenses.length > 10 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-50/80 border-t border-slate-100">
                  <div className="text-sm text-slate-600">
                    Showing {Math.min((expensesPage - 1) * 10 + 1, filteredExpenses.length)} to {Math.min(expensesPage * 10, filteredExpenses.length)} of {filteredExpenses.length} expenses
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setExpensesPage(Math.max(1, expensesPage - 1))}
                      disabled={expensesPage === 1}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-600">
                      Page {expensesPage} of {Math.ceil(filteredExpenses.length / 10)}
                    </span>
                    <button
                      onClick={() => setExpensesPage(Math.min(Math.ceil(filteredExpenses.length / 10), expensesPage + 1))}
                      disabled={expensesPage === Math.ceil(filteredExpenses.length / 10)}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {adminActiveTab === 'customers' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100">
                <div className="flex justify-between items-center mb-4 gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">All Customers</h2>
                  <button
                    onClick={() => {
                      fetchRentals()
                      fetchCustomers()
                      fetchExpenses()
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  <input
                    type="text"
                    value={customerFilter.contactNumber}
                    onChange={(e) => setCustomerFilter({...customerFilter, contactNumber: e.target.value})}
                    placeholder="Contact Number"
                    className="dash-input w-full sm:w-auto"
                  />
                </div>
              </div>
              <div className="overflow-x-auto lg:overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact Number</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Rentals</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Last Rental Date</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredCustomers.slice((customersPage - 1) * 10, customersPage * 10).map((customer) => (
                      <tr key={customer.id} onClick={() => setSelectedCustomer(customer)} className="cursor-pointer hover:bg-slate-50/80">
                        <td className="px-3 py-3 whitespace-nowrap text-sm truncate max-w-[10rem]" title={customer.name}>{customer.name}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm" title={customer.contactNumber}>{customer.contactNumber}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm truncate max-w-[12rem] text-slate-600" title={customer.address || 'N/A'}>{customer.address || 'N/A'}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-emerald-700 font-semibold">
                          {formatCurrency(customer.totalRevenue)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm">{customer.totalRentals}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-700">
                          {customer.lastRentalDate ? new Date(customer.lastRentalDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {canEdit && (
                              <div className="flex gap-1">
                                <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      startEditCustomer(customer)
                                    }}
                                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                                >
                                  <Edit size={16}/>
                                </button>
                              </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customers.length > 10 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-slate-50/80 border-t border-slate-100">
                    <div className="text-sm text-slate-600">
                      Showing {Math.min((customersPage - 1) * 10 + 1, customers.length)} to {Math.min(customersPage * 10, customers.length)} of {customers.length} customers
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCustomersPage(Math.max(1, customersPage - 1))}
                        disabled={customersPage === 1}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {customersPage} of {Math.ceil(customers.length / 10)}
                      </span>
                      <button
                        onClick={() => setCustomersPage(Math.min(Math.ceil(customers.length / 10), customersPage + 1))}
                        disabled={customersPage === Math.ceil(customers.length / 10)}
                        className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
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
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-100">
                <div className="flex justify-between items-center mb-4 gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">All Bills</h2>
                  <button
                    onClick={() => {
                      fetchBills()
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800"
                  >
                    <RefreshCw size={16} />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto lg:overflow-x-visible">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Bill Number</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Amount</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paid Amount</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {bills.map((bill) => (
                      <tr key={bill.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-blue-700">
                          {bill.billNumber}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm truncate max-w-[10rem]" title={bill.customer.name}>
                          {bill.customer.name}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                          {bill.customer.contactNumber}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-emerald-700 font-semibold">
                          {formatCurrency(bill.totalAmount)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-700 font-semibold">
                          {formatCurrency(bill.paidAmount)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            bill.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                            bill.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-700">
                          {bill.dueDate ? formatDateDDMMYYYY(bill.dueDate) : 'N/A'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-500">
                          {formatDateDDMMYYYY(bill.createdAt)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setSelectedRentalsForBill(bill.rentals)
                                setShowBillModal(true)
                              }}
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"
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
                  <div className="px-6 py-10 text-center">
                    <p className="text-slate-500 text-sm">No bills found. Create bills from rentals to see them here.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {adminActiveTab === 'field-ops' && user.pin && (
            <FieldOperatorsAdmin userPin={user.pin} />
          )}

          {adminActiveTab === 'gps' && user.pin && (
            <GpsMeasurementsAdmin userPin={user.pin} canEdit={canEdit} onApproved={fetchRentals} />
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
                <label className="block text-sm font-medium mb-2">Village / Location</label>
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
                            <div>{rentalVillage(rental) || 'N/A'}</div>
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

      {/* Delete Rental Modal */}
      {showDeleteRentalModal && rentalToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Delete Rental</h2>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete this rental?
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div><strong>Machine:</strong> {rentalToDelete.machineType}</div>
                  <div><strong>Customer:</strong> {rentalToDelete.customer.name}</div>
                  <div><strong>Amount:</strong> {formatCurrency(rentalToDelete.totalAmount)}</div>
                  <div><strong>Date:</strong> {formatDateDDMMYYYY(rentalToDelete.date)}</div>
                </div>
              </div>
              <p className="text-red-600 text-sm">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={confirmDeleteRental}
                className="flex-1 bg-red-500 text-white p-2 rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteRentalModal(false)
                  setRentalToDelete(null)
                }}
                className="flex-1 bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Expense Modal */}
      {showDeleteExpenseModal && expenseToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Delete Expense</h2>
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete this expense?
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-2">
                  <div><strong>Description:</strong> {expenseToDelete.description}</div>
                  <div><strong>Amount:</strong> {formatCurrency(expenseToDelete.amount)}</div>
                  <div><strong>Operator:</strong> {expenseToDelete.operator.name}</div>
                  <div><strong>Date:</strong> {formatDateDDMMYYYY(expenseToDelete.date)}</div>
                </div>
              </div>
              <p className="text-red-600 text-sm">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={confirmDeleteExpense}
                className="flex-1 bg-red-500 text-white p-2 rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteExpenseModal(false)
                  setExpenseToDelete(null)
                }}
                className="flex-1 bg-gray-500 text-white p-2 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

  const glassLabel = 'block text-sm font-medium mb-2 text-gray-800'
  const requiredMark = <span className="text-red-500 ml-0.5">*</span>
  const machineIcon = (id: string) => {
    if (id === 'harvester') return <Leaf size={22} />
    if (id === 'excavator') return <Wrench size={22} />
    return <Truck size={22} />
  }

  // Operator view
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden text-gray-900 bg-white">
      <div className="relative w-full max-w-2xl mx-auto px-3 sm:px-4 pt-4 pb-52">
        <div className="glass-panel rounded-2xl p-3 sm:p-4 mb-4 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/rentralogo.png" alt="JD Agro & Earthmovers Logo" className="w-12 h-12 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Operator</p>
              <h1 className="text-lg font-bold truncate">Hi, {user.name}</h1>
            </div>
          </div>
          <button
            onClick={() => setUser(null)}
            className="shrink-0 flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-2.5 py-2 rounded-xl text-sm"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        {successMessage && (
          <div className="mb-4 glass-panel rounded-xl px-4 py-3 flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={18} />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="mb-4 glass-panel rounded-xl px-4 py-3 text-red-600">{error}</div>
        )}

        {activeTab === 'new-rental' && (
          <>
            <div className="glass-panel rounded-2xl p-3 sm:p-6 mb-4 overflow-hidden">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Plus size={20} /> Add New Rental
            </h2>

            {/* Customer Selection */}
            <div className="mb-6 p-3 sm:p-4 rounded-2xl bg-gray-50 border border-gray-200 min-w-0">
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2"><User size={18} /> Customer Information</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className={glassLabel}>Customer Name{requiredMark}</label>
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
                      className="glass-input"
                      required
                    />
                    {showCustomerDropdown && (
                      <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto mt-1">
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
                              className="p-3 hover:bg-gray-100 cursor-pointer"
                              onMouseDown={(e) => e.preventDefault()}
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
                    <label className={`${glassLabel} flex items-center gap-2`}><Phone size={16} /> Contact Number{requiredMark}</label>
                    <input
                      type="tel"
                      inputMode="numeric"
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
                      className="glass-input"
                      required
                    />
                    {mobileError && <p className="text-red-300 text-sm mt-1">{mobileError}</p>}
                  </div>
                </div>
                <div>
                  <label className={`${glassLabel} flex items-center gap-2`}><MapPin size={16} /> Address / Location{requiredMark}</label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Enter customer address or work location"
                    className="glass-input"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className={glassLabel}>Nature of Work / Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of the work"
                className="glass-input"
              />
            </div>

            <div className="mb-6">
              <label className={`${glassLabel} flex items-center gap-2`}><IndianRupee size={16} /> Advance Amount (Optional)</label>
              <input
                type="number"
                inputMode="decimal"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="0"
                className="glass-input"
                min="0"
                step="0.01"
              />
            </div>

            <div className="mb-6">
              <label className={`${glassLabel} flex items-center gap-2`}><CreditCard size={16} /> Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="glass-input"
              >
                <option value="Cash">Cash</option>
                <option value="Online">Online</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            <div className="mb-6">
              <label className={`${glassLabel} flex items-center gap-2`}><Calendar size={16} /> Date of Rental{requiredMark}</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="glass-input"
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

            <p className={`${glassLabel} mb-2`}>Machine{requiredMark}</p>
            <div className="grid grid-cols-3 gap-2 mb-4 min-w-0">
              {MACHINES.map((machine) => (
                <button
                  key={machine.id}
                  onClick={() => {
                    setSelectedMachine(machine.id);
                    if (machine.id === 'harvester') {
                      setSelectedUnit('acre');
                    }
                  }}
                  className={`p-2 sm:p-3 min-h-[80px] min-w-0 rounded-2xl border transition-colors ${
                    selectedMachine === machine.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`w-9 h-9 mx-auto mb-2 rounded-xl flex items-center justify-center text-white ${
                    machine.id === 'harvester' ? 'bg-green-500/90' :
                    machine.id === 'excavator' ? 'bg-orange-500/90' :
                    'bg-blue-500/90'
                  }`}>
                    {machineIcon(machine.id)}
                  </div>
                  <div className="font-medium text-[11px] sm:text-sm leading-tight break-words">{machine.name}</div>
                </button>
              ))}
            </div>

            {selectedMachine && (
              <div className="mb-4 min-w-0">
                <label className={glassLabel}>Unit Type{requiredMark}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-0">
                  {MACHINES.find(m => m.id === selectedMachine)?.units.map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setSelectedUnit(unit)}
                      className={`p-2 sm:p-3 min-h-[44px] min-w-0 rounded-xl capitalize text-sm ${
                        selectedUnit === unit
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-800'
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
                <div className="flex flex-wrap justify-between items-center gap-2 mb-2 min-w-0">
                  <h3 className="text-lg font-medium">Edit Rates</h3>
                    <button
                    onClick={() => setShowEditRates(!showEditRates)}
                    className="bg-blue-500 text-white px-3 py-2 rounded-xl text-sm shrink-0"
                  >
                    {showEditRates ? 'Cancel' : 'Edit Rates'}
                  </button>
                </div>
                {showEditRates && (
                  <div className="space-y-4">
                    {MACHINES.filter(machine => !selectedMachine || machine.id === selectedMachine).map((machine) => (
                      <div key={machine.id} className="rounded-xl p-4 bg-gray-50 border border-gray-200">
                        <h4 className="font-medium mb-2 capitalize">{machine.name} Rates</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                                className="glass-input"
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
                                  className="glass-input"
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
                                  className="glass-input"
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
                <label className={glassLabel}>
                  {selectedUnit === 'hourly' ? 'Time Selection' : (selectedUnit === 'monthly' || selectedUnit === 'work') ? 'Amount' : 'Quantity'}{requiredMark}
                </label>
                {(selectedUnit === 'monthly' || selectedUnit === 'work') ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="glass-input"
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
                    className="glass-input"
                  />
                ) : selectedUnit === 'hourly' ? (
                  <div>
                    {timeSlots.map((slot, index) => (
                      <div key={index} className="rounded-2xl p-3 mb-2 bg-gray-50 border border-gray-200">
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
                              className="glass-input text-xl"
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
                              className="glass-input text-xl"
                            />
                          </div>
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-blue-700 text-center">
                          {calculateHours(slot.start, slot.end).toFixed(2)} hrs
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                            onClick={() => updateTimeSlotType(index, false)}
                            className={`px-3 py-3 rounded-xl text-sm font-medium ${
                              !slot.isBreaker
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            Normal
                          </button>
                          <button
                            onClick={() => updateTimeSlotType(index, true)}
                            className={`px-3 py-3 rounded-xl text-sm font-medium ${
                              slot.isBreaker
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            Breaker
                          </button>
                          {timeSlots.length > 1 && (
                            <button
                              onClick={() => removeTimeSlot(index)}
                              className="col-span-2 bg-red-500/80 text-white px-3 py-2 rounded-xl text-sm font-medium"
                              title="Remove time slot"
                            >
                              Remove slot
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="space-y-2">
                      {selectedMachine === 'excavator' && selectedUnit === 'hourly' ? (
                        <>
                          <div className="text-lg font-semibold text-center p-2 rounded-xl bg-blue-50">
                            JCB Hours: {timeSlots.filter(s => !s.isBreaker).reduce((sum, s) => sum + calculateHours(s.start, s.end), 0).toFixed(2)} hrs
                          </div>
                          <div className="text-lg font-semibold text-center p-2 rounded-xl bg-orange-50">
                            Breaker Hours: {timeSlots.filter(s => s.isBreaker).reduce((sum, s) => sum + calculateHours(s.start, s.end), 0).toFixed(2)} hrs
                          </div>
                          <div className="text-lg font-semibold text-center p-2 rounded-xl bg-blue-50">
                            Total Hours: {quantity.toFixed(2)} hrs
                          </div>
                        </>
                      ) : (
                        <div className="text-lg font-semibold text-center p-2 rounded-xl bg-blue-50">
                          Total Hours: {quantity.toFixed(2)} hrs
                        </div>
                      )}
                      <div className="text-lg font-semibold text-center p-2 rounded-xl bg-green-50">
                        Total Amount: {selectedMachine === 'excavator' && selectedUnit === 'hourly' ? formatCurrency(timeSlots.reduce((sum, slot) => sum + slot.calculatedAmount, 0)) : formatCurrency(quantity * prices[selectedMachine as keyof typeof prices][selectedUnit as keyof typeof prices[keyof typeof prices]])}
                      </div>
                    </div>
                    <button
                      onClick={addTimeSlot}
                      className="w-full bg-blue-500 text-white px-3 py-3 rounded-xl text-sm mt-2"
                    >
                      Add Time Slot
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3 w-full min-w-0">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center"
                    >
                      <Minus size={20} />
                    </button>
                    {selectedUnit === 'trip' ? (
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 p-2 glass-input text-center text-2xl font-bold"
                        min="1"
                      />
                    ) : (
                      <span className="text-2xl font-bold w-16 text-center">{quantity}</span>
                    )}
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                )}

              </div>
            )}

            {selectedMachine && selectedUnit && !(selectedMachine === 'excavator' && selectedUnit === 'hourly') && (
              <div className="mb-4 p-4 rounded-2xl bg-gray-50 border border-gray-200">
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
              className="hidden"
            >
              {loading ? 'Adding...' : 'Add Rental Entry'}
            </button>
          </div>

          <div className="glass-panel rounded-2xl p-4 sm:p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Receipt size={18} /> Your Last 3 Rentals</h3>
            <div className="space-y-3">
              {rentals
                .filter(r => r.operator.name === user.name)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map((rental) => (
                  <div key={rental.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium capitalize">{rental.machineType}</div>
                      <div className="font-semibold text-green-600">{formatCurrency(rental.totalAmount)}</div>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>Customer: {rental.customer.name} ({rental.customer.contactNumber})</div>
                      <div>Location: {rentalVillage(rental) || 'N/A'}</div>
                      <div>Date: {new Date(rental.date).toLocaleDateString()}</div>
                      <div>Quantity: {rental.quantity} {rental.unitType}</div>
                      {rental.description && <div>Description: {rental.description}</div>}
                      <div className="flex flex-wrap justify-between gap-1 pt-2 border-t border-gray-200">
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
          <div className="glass-panel rounded-2xl p-3 sm:p-6 mb-4 overflow-hidden min-w-0">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Wallet size={20} /> Add Expense</h2>
            <div className="space-y-4">
              <div>
                <label className={glassLabel}>Description</label>
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
                  className="glass-input"
                />
              </div>
              <div>
                <label className={glassLabel}>Amount{requiredMark}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0"
                  className="glass-input"
                  min="0"
                />
              </div>
              <div>
                <label className={`${glassLabel} flex items-center gap-2`}><User size={16} /> Operator{requiredMark}</label>
                <select
                  value={selectedOperatorId || ''}
                  onChange={(e) => setSelectedOperatorId(e.target.value ? parseInt(e.target.value) : null)}
                  className="glass-input"
                >
                  <option value="">Select Operator</option>
                  {operators.map((operator) => (
                    <option key={operator.id} value={operator.id}>{operator.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`${glassLabel} flex items-center gap-2`}><Calendar size={16} /> Date</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="glass-input"
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={`${glassLabel} flex items-center gap-2`}><Fuel size={16} /> Diesel Cost (Optional)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={expenseDieselCost}
                    onChange={(e) => setExpenseDieselCost(e.target.value)}
                    placeholder="0"
                    className="glass-input disabled:opacity-50"
                    min="0"
                    disabled={expenseDescription.trim() !== ''}
                  />
                </div>
                <div>
                  <label className={`${glassLabel} flex items-center gap-2`}><Wrench size={16} /> Maintenance Cost (Optional)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={expenseMaintenanceCost}
                    onChange={(e) => setExpenseMaintenanceCost(e.target.value)}
                    placeholder="0"
                    className="glass-input disabled:opacity-50"
                    min="0"
                    disabled={expenseDescription.trim() !== ''}
                  />
                </div>
                <div>
                  <label className={glassLabel}>Operator Salary (Optional)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={expenseOperatorSalary}
                    onChange={(e) => setExpenseOperatorSalary(e.target.value)}
                    placeholder="0"
                    className="glass-input disabled:opacity-50"
                    min="0"
                    disabled={expenseDescription.trim() !== ''}
                  />
                </div>
              </div>
              <button
                onClick={saveExpense}
                disabled={loading || (!selectedOperatorId) || (!expenseDescription && !expenseAmount && !expenseDieselCost && !expenseMaintenanceCost && !expenseOperatorSalary)}
                className="w-full bg-green-500 text-white p-3 rounded-xl disabled:bg-gray-300 min-h-[48px]"
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
                      <div key={expense.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
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
          <div className="glass-panel rounded-2xl p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Clock size={20} /> Your Recent Rentals</h2>
            <input
              type="text"
              value={operatorRentalSearch}
              onChange={(e) => setOperatorRentalSearch(e.target.value)}
              placeholder="Search customer name"
              className="glass-input mb-4"
            />
            <div className="space-y-3">
              {rentals
                .filter(r => r.operator.name === user.name)
                .filter(r => !operatorRentalSearch || r.customer.name.toLowerCase().includes(operatorRentalSearch.toLowerCase()))
                .slice(0, operatorRentalsShown)
                .map((rental) => (
                  <div key={rental.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium capitalize">{rental.machineType}</div>
                      <div className="font-semibold text-green-600">{formatCurrency(rental.totalAmount)}</div>
                    </div>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Customer: {rental.customer.name} ({rental.customer.contactNumber})</div>
              <div>Location: {rentalVillage(rental) || 'N/A'}</div>
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
              <div className="flex flex-wrap justify-between gap-1 min-w-0">
              {(rental as any).description && <div className="w-full break-words">Description: {(rental as any).description}</div>}
                <span>Paid: <span className="text-green-600 font-medium">{formatCurrency(rental.paidAmount || 0)}</span></span>
                <span>Pending: <span className="text-red-600 font-medium">{formatCurrency(rental.totalAmount - (rental.paidAmount || 0))}</span></span>
              </div>
            </div>
                  </div>
                ))}
            </div>
            {rentals.filter(r => r.operator.name === user.name).filter(r => !operatorRentalSearch || r.customer.name.toLowerCase().includes(operatorRentalSearch.toLowerCase())).length > operatorRentalsShown && (
              <button
                onClick={() => setOperatorRentalsShown(operatorRentalsShown + 10)}
                className="w-full mt-4 py-3 rounded-xl bg-gray-100 border border-gray-200"
              >
                Show more
              </button>
            )}
          </div>
        )}
      </div>

      {activeTab === 'new-rental' && (
        <div className="fixed inset-x-0 z-40 px-3 sm:px-4" style={{ bottom: 'calc(7.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="max-w-2xl mx-auto w-full">
            <button
              onClick={createRental}
              disabled={!selectedMachine || !selectedUnit || !customerName || !customerContact || !customerAddress || loading}
              className="w-full max-w-full bg-green-500 text-white p-3 sm:p-4 rounded-2xl disabled:bg-gray-300 shadow-lg min-h-[48px] font-semibold"
            >
              {loading ? 'Adding...' : 'Add Rental Entry'}
            </button>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 px-2 sm:px-3 pt-2 bg-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-2xl mx-auto glass-panel rounded-2xl grid grid-cols-3 gap-0 p-1 min-w-0">
          <button
            onClick={() => setActiveTab('new-rental')}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-w-0 rounded-xl text-[11px] font-medium ${
              activeTab === 'new-rental' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
            }`}
          >
            <Plus size={18} />
            <span className="truncate w-full text-center">Rental</span>
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-w-0 rounded-xl text-[11px] font-medium ${
              activeTab === 'expenses' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
            }`}
          >
            <Wallet size={18} />
            <span className="truncate w-full text-center">Expense</span>
          </button>
          <button
            onClick={() => setActiveTab('rentals')}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 min-w-0 rounded-xl text-[11px] font-medium ${
              activeTab === 'rentals' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'
            }`}
          >
            <Clock size={18} />
            <span className="truncate w-full text-center">Rentals</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
