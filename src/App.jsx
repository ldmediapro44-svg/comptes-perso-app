import { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

function App() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [recurringTransactions, setRecurringTransactions] = useState([])
  const [dueRecurringTransactions, setDueRecurringTransactions] = useState([])

  const [name, setName] = useState("")
  const [initialBalance, setInitialBalance] = useState("")

  const [selectedAccount, setSelectedAccount] = useState("")
  const [type, setType] = useState("expense")
  const [label, setLabel] = useState("")
  const [category, setCategory] = useState("")
  const [amount, setAmount] = useState("")

  const [editingTransactionId, setEditingTransactionId] = useState(null)
  const [editingLabel, setEditingLabel] = useState("")
  const [editingCategory, setEditingCategory] = useState("")
  const [editingType, setEditingType] = useState("expense")
  const [editingAmount, setEditingAmount] = useState("")

  const [selectedMonth, setSelectedMonth] = useState("all")

  const [recurringAccountId, setRecurringAccountId] = useState("")
  const [recurringType, setRecurringType] = useState("expense")
  const [recurringCategory, setRecurringCategory] = useState("")
  const [recurringLabel, setRecurringLabel] = useState("")
  const [recurringAmount, setRecurringAmount] = useState("")
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState("")

  const categories = [
    "Courses",
    "Logement",
    "Transport",
    "Carburant",
    "Santé",
    "Loisirs",
    "Restaurant",
    "Abonnements",
    "Salaire",
    "Virement",
    "Épargne",
    "Autre",
  ]

  const normalizeCategory = (rawCategory) => {
    if (!rawCategory || typeof rawCategory !== "string") return ""

    const value = rawCategory.trim().toLowerCase()

    const mapping = {
      cours: "Courses",
      course: "Courses",
      courses: "Courses",
      logement: "Logement",
      transport: "Transport",
      carburant: "Carburant",
      sante: "Santé",
      santé: "Santé",
      loisirs: "Loisirs",
      restaurant: "Restaurant",
      restaurants: "Restaurant",
      abonnement: "Abonnements",
      abonnements: "Abonnements",
      salaire: "Salaire",
      virement: "Virement",
      epargne: "Épargne",
      épargne: "Épargne",
      autre: "Autre",
    }

    return mapping[value] || rawCategory.trim()
  }

  const normalizeTransactionForDisplay = (transaction) => {
    return {
      ...transaction,
      label: transaction.label?.trim() || "Sans libellé",
      category: normalizeCategory(transaction.category),
    }
  }

  const formatCurrency = (value) => {
    const amountNumber = Number(value || 0)
    return amountNumber.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const parseAmount = (value) => {
    if (typeof value !== "string") return Number(value) || 0
    const normalized = value.replace(",", ".").trim()
    return Number(normalized)
  }

  const getMonthLabel = (monthValue) => {
    if (!monthValue || monthValue === "all") return "Tous les mois"

    const [year, month] = monthValue.split("-")
    const date = new Date(Number(year), Number(month) - 1, 1)

    return date.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })
  }

  const getCurrentYearMonth = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    return `${year}-${month}`
  }

  const signUp = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Email et mot de passe obligatoires")
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      console.error("Erreur inscription :", error)
      alert(error.message)
      return
    }

    alert("Compte créé. Vérifie ton email si une confirmation est demandée.")
  }

  const signIn = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Email et mot de passe obligatoires")
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error("Erreur connexion :", error)
      alert(error.message)
      return
    }

    setUser(data.user)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAccounts([])
    setTransactions([])
    setRecurringTransactions([])
    setDueRecurringTransactions([])
  }

  const fetchAccounts = async (currentUser) => {
    if (!currentUser) return

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("name", { ascending: true })

    if (error) {
      console.error("Erreur chargement comptes :", error)
      return
    }

    setAccounts(data || [])
  }

  const cleanTransactionsData = async (rows) => {
    const updates = rows
      .map((t) => {
        const normalizedCategory = normalizeCategory(t.category)
        const trimmedLabel = t.label?.trim() || ""

        const needsCategoryUpdate = normalizedCategory !== (t.category || "")
        const needsLabelUpdate = trimmedLabel !== (t.label || "")

        if (!needsCategoryUpdate && !needsLabelUpdate) {
          return null
        }

        return {
          id: t.id,
          category: normalizedCategory,
          label: trimmedLabel,
        }
      })
      .filter(Boolean)

    if (updates.length === 0) return

    for (const update of updates) {
      const { error } = await supabase
        .from("transactions")
        .update({
          category: update.category,
          label: update.label,
        })
        .eq("id", update.id)

      if (error) {
        console.error("Erreur nettoyage transaction :", error)
      }
    }
  }

  const fetchTransactions = async (currentUser) => {
    if (!currentUser) return

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", currentUser.id)

    if (error) {
      console.error("Erreur chargement transactions :", error)
      return
    }

    const rows = data || []
    await cleanTransactionsData(rows)

    const normalizedRows = rows.map(normalizeTransactionForDisplay)
    setTransactions(normalizedRows)
  }

  const fetchRecurringTransactions = async (currentUser) => {
    if (!currentUser) return

    const { data, error } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Erreur chargement récurrences :", error)
      return
    }

    setRecurringTransactions(data || [])
  }

  const computeDueRecurringTransactions = (rows) => {
    const now = new Date()
    const currentDay = now.getDate()
    const currentYearMonth = getCurrentYearMonth()

    const due = rows.filter((r) => {
      if (!r.is_active) return false
      if (Number(r.day_of_month) > currentDay) return false
      if (r.last_generated_month === currentYearMonth) return false
      return true
    })

    setDueRecurringTransactions(due)
  }

  const addAccount = async () => {
    if (!user) {
      alert("Tu dois être connecté.")
      return
    }

    if (!name.trim()) {
      alert("Nom du compte obligatoire")
      return
    }

    const { error } = await supabase.from("accounts").insert([
      {
        user_id: user.id,
        name: name.trim(),
        initial_balance: parseAmount(initialBalance) || 0,
      },
    ])

    if (error) {
      console.error("Erreur ajout compte :", error)
      alert(error.message)
      return
    }

    setName("")
    setInitialBalance("")
    fetchAccounts(user)
  }

  const addTransaction = async () => {
    if (!user) {
      alert("Tu dois être connecté")
      return
    }

    const parsedAmount = parseAmount(amount)
    const normalizedCategory = normalizeCategory(category)

    if (
      !selectedAccount ||
      !label.trim() ||
      !normalizedCategory ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      alert("Compte, libellé, catégorie et montant valide sont obligatoires")
      return
    }

    const { error } = await supabase.from("transactions").insert([
      {
        user_id: user.id,
        account_id: selectedAccount,
        type,
        label: label.trim(),
        category: normalizedCategory,
        amount: parsedAmount,
        date: new Date().toISOString().split("T")[0],
      },
    ])

    if (error) {
      console.error("Erreur transaction :", error)
      alert(error.message)
      return
    }

    setSelectedAccount("")
    setType("expense")
    setLabel("")
    setCategory("")
    setAmount("")

    fetchTransactions(user)
    fetchAccounts(user)
  }

  const addRecurringTransaction = async () => {
    if (!user) return

    const parsedAmount = parseAmount(recurringAmount)
    const day = Number(recurringDayOfMonth)
    const normalizedCategory = normalizeCategory(recurringCategory)

    if (
      !recurringAccountId ||
      !normalizedCategory ||
      !recurringLabel.trim() ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0 ||
      Number.isNaN(day) ||
      day < 1 ||
      day > 31
    ) {
      alert("Tous les champs de la récurrence sont obligatoires.")
      return
    }

    const { error } = await supabase.from("recurring_transactions").insert([
      {
        user_id: user.id,
        account_id: recurringAccountId,
        type: recurringType,
        category: normalizedCategory,
        label: recurringLabel.trim(),
        amount: parsedAmount,
        day_of_month: day,
        is_active: true,
      },
    ])

    if (error) {
      console.error("Erreur ajout récurrence :", error)
      alert(error.message)
      return
    }

    setRecurringAccountId("")
    setRecurringType("expense")
    setRecurringCategory("")
    setRecurringLabel("")
    setRecurringAmount("")
    setRecurringDayOfMonth("")

    await fetchRecurringTransactions(user)
  }

  const validateRecurringTransaction = async (recurringItem) => {
    const currentYearMonth = getCurrentYearMonth()

    const { error: insertError } = await supabase.from("transactions").insert([
      {
        user_id: user.id,
        account_id: recurringItem.account_id,
        type: recurringItem.type,
        label: recurringItem.label,
        category: normalizeCategory(recurringItem.category),
        amount: Number(recurringItem.amount),
        date: new Date().toISOString().split("T")[0],
      },
    ])

    if (insertError) {
      console.error("Erreur validation récurrence :", insertError)
      alert(insertError.message)
      return
    }

    const { error: updateError } = await supabase
      .from("recurring_transactions")
      .update({
        last_generated_month: currentYearMonth,
      })
      .eq("id", recurringItem.id)

    if (updateError) {
      console.error("Erreur mise à jour récurrence :", updateError)
      alert(updateError.message)
      return
    }

    await fetchTransactions(user)
    await fetchAccounts(user)
    await fetchRecurringTransactions(user)
  }

  const ignoreRecurringTransactionForThisMonth = async (recurringItem) => {
    const currentYearMonth = getCurrentYearMonth()

    const { error } = await supabase
      .from("recurring_transactions")
      .update({
        last_generated_month: currentYearMonth,
      })
      .eq("id", recurringItem.id)

    if (error) {
      console.error("Erreur ignore récurrence :", error)
      alert(error.message)
      return
    }

    await fetchRecurringTransactions(user)
  }

  const toggleRecurringTransaction = async (recurringItem) => {
    const { error } = await supabase
      .from("recurring_transactions")
      .update({
        is_active: !recurringItem.is_active,
      })
      .eq("id", recurringItem.id)

    if (error) {
      console.error("Erreur activation récurrence :", error)
      alert(error.message)
      return
    }

    await fetchRecurringTransactions(user)
  }

  const deleteRecurringTransaction = async (recurringItem) => {
    const confirmed = window.confirm(
      `Supprimer la récurrence "${recurringItem.label}" ?`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from("recurring_transactions")
      .delete()
      .eq("id", recurringItem.id)

    if (error) {
      console.error("Erreur suppression récurrence :", error)
      alert(error.message)
      return
    }

    await fetchRecurringTransactions(user)
  }

  const startEditingTransaction = (transaction) => {
    setEditingTransactionId(transaction.id)
    setEditingLabel(transaction.label || "")
    setEditingCategory(normalizeCategory(transaction.category) || "")
    setEditingType(transaction.type || "expense")
    setEditingAmount(Number(transaction.amount || 0).toFixed(2))
  }

  const cancelEditingTransaction = () => {
    setEditingTransactionId(null)
    setEditingLabel("")
    setEditingCategory("")
    setEditingType("expense")
    setEditingAmount("")
  }

  const saveEditedTransaction = async () => {
    if (!editingTransactionId) return

    const parsedAmount = parseAmount(editingAmount)
    const normalizedCategory = normalizeCategory(editingCategory)

    if (
      !editingLabel.trim() ||
      !normalizedCategory ||
      !editingType ||
      Number.isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      alert("Libellé, catégorie, type et montant valide sont obligatoires")
      return
    }

    const { error } = await supabase
      .from("transactions")
      .update({
        label: editingLabel.trim(),
        category: normalizedCategory,
        type: editingType,
        amount: parsedAmount,
      })
      .eq("id", editingTransactionId)

    if (error) {
      console.error("Erreur modification transaction :", error)
      alert(error.message)
      return
    }

    cancelEditingTransaction()
    fetchTransactions(user)
    fetchAccounts(user)
  }

  const deleteTransaction = async (transactionId) => {
    const confirmed = window.confirm("Supprimer cette transaction ?")
    if (!confirmed) return

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)

    if (error) {
      console.error("Erreur suppression transaction :", error)
      alert(error.message)
      return
    }

    if (editingTransactionId === transactionId) {
      cancelEditingTransaction()
    }

    fetchTransactions(user)
    fetchAccounts(user)
  }

  const deleteAccount = async (accountId, accountName) => {
    const linkedTransactions = transactions.filter(
      (t) => t.account_id === accountId
    )

    if (linkedTransactions.length > 0) {
      alert(
        `Impossible de supprimer "${accountName}" car ce compte contient encore ${linkedTransactions.length} transaction(s). Supprime d'abord les transactions liées.`
      )
      return
    }

    const linkedRecurring = recurringTransactions.filter(
      (r) => r.account_id === accountId
    )

    if (linkedRecurring.length > 0) {
      alert(
        `Impossible de supprimer "${accountName}" car ce compte contient encore ${linkedRecurring.length} récurrence(s). Supprime ou désactive d'abord les récurrences liées.`
      )
      return
    }

    const confirmed = window.confirm(
      `Supprimer définitivement le compte "${accountName}" ?`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", accountId)

    if (error) {
      console.error("Erreur suppression compte :", error)
      alert(error.message)
      return
    }

    if (selectedAccount === accountId) {
      setSelectedAccount("")
    }

    fetchAccounts(user)
  }

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        setUser(session.user)
        await fetchAccounts(session.user)
        await fetchTransactions(session.user)
        await fetchRecurringTransactions(session.user)
      }
    }

    getSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        await fetchAccounts(currentUser)
        await fetchTransactions(currentUser)
        await fetchRecurringTransactions(currentUser)
      } else {
        setAccounts([])
        setTransactions([])
        setRecurringTransactions([])
        setDueRecurringTransactions([])
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    computeDueRecurringTransactions(recurringTransactions)
  }, [recurringTransactions])

  const availableMonths = useMemo(() => {
    const monthSet = new Set()

    transactions.forEach((t) => {
      if (t.date && typeof t.date === "string" && t.date.length >= 7) {
        monthSet.add(t.date.slice(0, 7))
      }
    })

    return Array.from(monthSet).sort((a, b) => b.localeCompare(a))
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    if (selectedMonth === "all") return transactions

    return transactions.filter((t) => {
      if (!t.date || typeof t.date !== "string") return false
      return t.date.slice(0, 7) === selectedMonth
    })
  }, [transactions, selectedMonth])

  const getCategoryColor = (categoryName) => {
    const normalized = normalizeCategory(categoryName)

    const colors = {
      Courses: "#f59e0b",
      Logement: "#6366f1",
      Transport: "#0ea5e9",
      Carburant: "#ef4444",
      Santé: "#10b981",
      Loisirs: "#a855f7",
      Restaurant: "#f97316",
      Abonnements: "#64748b",
      Salaire: "#22c55e",
      Virement: "#14b8a6",
      Épargne: "#06b6d4",
      Autre: "#94a3b8",
    }

    return colors[normalized] || "#94a3b8"
  }

  const accountsWithBalances = useMemo(() => {
    return accounts.map((acc) => {
      const accountTransactions = filteredTransactions
        .filter((t) => t.account_id === acc.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))

      const totalIncome = accountTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0)

      const totalExpense = accountTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0)

      const currentBalance =
        Number(acc.initial_balance) + totalIncome - totalExpense

      return {
        ...acc,
        accountTransactions,
        totalIncome,
        totalExpense,
        currentBalance,
      }
    })
  }, [accounts, filteredTransactions])

  const globalBalance = accountsWithBalances.reduce(
    (total, acc) => total + acc.currentBalance,
    0
  )

  const totalIncomeGlobal = accountsWithBalances.reduce(
    (total, acc) => total + acc.totalIncome,
    0
  )

  const totalExpenseGlobal = accountsWithBalances.reduce(
    (total, acc) => total + acc.totalExpense,
    0
  )

  const expenseByCategory = useMemo(() => {
    const map = {}

    filteredTransactions
      .filter((t) => t.type === "expense" && normalizeCategory(t.category))
      .forEach((t) => {
        const normalizedCategory = normalizeCategory(t.category)
        if (!normalizedCategory) return

        if (!map[normalizedCategory]) map[normalizedCategory] = 0
        map[normalizedCategory] += Number(t.amount)
      })

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percent:
          totalExpenseGlobal > 0
            ? Math.round((value / totalExpenseGlobal) * 100)
            : 0,
        color: getCategoryColor(name),
      }))
      .sort((a, b) => b.value - a.value)
  }, [filteredTransactions, totalExpenseGlobal])

  const uncategorizedCount = useMemo(() => {
    return filteredTransactions.filter(
      (t) => !normalizeCategory(t.category) || normalizeCategory(t.category).trim() === ""
    ).length
  }, [filteredTransactions])

  const topCategory = expenseByCategory[0]

  const maxExpenseCategoryValue =
    expenseByCategory.length > 0
      ? Math.max(...expenseByCategory.map((item) => item.value))
      : 0

  const financeInsight = useMemo(() => {
    if (totalExpenseGlobal === 0) {
      return {
        title: "Situation saine",
        message:
          "Aucune dépense catégorisée détectée pour la période sélectionnée. Change de mois ou ajoute des dépenses pour obtenir une vraie analyse.",
        color: "#0f766e",
        background: "#ecfeff",
        border: "#99f6e4",
      }
    }

    if (uncategorizedCount > 0) {
      return {
        title: "Données incomplètes",
        message: `${uncategorizedCount} transaction(s) n'ont pas de catégorie sur la période sélectionnée. Corrige-les pour obtenir une analyse fiable et exploitable.`,
        color: "#9a3412",
        background: "#fff7ed",
        border: "#fdba74",
      }
    }

    if (topCategory && topCategory.percent >= 60) {
      return {
        title: "Concentration élevée des dépenses",
        message: `La catégorie ${topCategory.name} représente ${topCategory.percent}% de tes dépenses sur la période (${formatCurrency(topCategory.value)} €). C'est ta priorité d'optimisation immédiate.`,
        color: "#991b1b",
        background: "#fef2f2",
        border: "#fca5a5",
      }
    }

    if (topCategory && topCategory.percent >= 40) {
      return {
        title: "Point de vigilance",
        message: `La catégorie ${topCategory.name} pèse ${topCategory.percent}% de tes dépenses sur la période (${formatCurrency(topCategory.value)} €). Surveille-la, elle devient dominante.`,
        color: "#92400e",
        background: "#fffbeb",
        border: "#fcd34d",
      }
    }

    return {
      title: "Répartition équilibrée",
      message: `Tes dépenses sont assez réparties sur la période sélectionnée. La catégorie principale reste ${topCategory?.name || "N/A"} avec ${topCategory?.percent || 0}% du total.`,
      color: "#065f46",
      background: "#ecfdf5",
      border: "#86efac",
    }
  }, [totalExpenseGlobal, uncategorizedCount, topCategory])

  const estimatedSaving =
    topCategory && topCategory.value > 0
      ? Math.round(topCategory.value * 0.1 * 100) / 100
      : 0

  const isAccountFormValid = name.trim().length > 0

  const isTransactionFormValid =
    selectedAccount !== "" &&
    type !== "" &&
    category !== "" &&
    label.trim().length > 0 &&
    amount !== "" &&
    !Number.isNaN(parseAmount(amount)) &&
    parseAmount(amount) > 0

  const isEditingFormValid =
    editingLabel.trim().length > 0 &&
    editingCategory !== "" &&
    editingType !== "" &&
    editingAmount !== "" &&
    !Number.isNaN(parseAmount(editingAmount)) &&
    parseAmount(editingAmount) > 0

  const isRecurringFormValid =
    recurringAccountId !== "" &&
    recurringType !== "" &&
    recurringCategory !== "" &&
    recurringLabel.trim().length > 0 &&
    recurringAmount !== "" &&
    !Number.isNaN(parseAmount(recurringAmount)) &&
    parseAmount(recurringAmount) > 0 &&
    recurringDayOfMonth !== "" &&
    Number(recurringDayOfMonth) >= 1 &&
    Number(recurringDayOfMonth) <= 31

  const pageStyle = {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #fef9f8 0%, #f4f8ff 45%, #eefcf8 100%)",
    padding: "30px 18px 60px",
    fontFamily: "Arial, sans-serif",
    color: "#1f2937",
  }

  const appStyle = {
    maxWidth: 1240,
    margin: "0 auto",
  }

  const heroStyle = {
    background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #14b8a6 100%)",
    color: "#ffffff",
    borderRadius: 30,
    padding: 40,
    marginBottom: 30,
    boxShadow: "0 24px 55px rgba(79, 70, 229, 0.22)",
    border: "1px solid rgba(255,255,255,0.14)",
  }

  const sectionCardStyle = {
    backgroundColor: "rgba(255,255,255,0.82)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 24,
    padding: 28,
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  }

  const sectionTitleStyle = {
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#0f172a",
    letterSpacing: -0.8,
  }

  const inputStyle = {
    width: "100%",
    padding: 15,
    fontSize: 16,
    border: "1px solid #dbe3f0",
    borderRadius: 14,
    outline: "none",
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    color: "#0f172a",
  }

  const primaryButtonStyle = {
    padding: "15px 20px",
    fontSize: 16,
    fontWeight: "bold",
    border: "none",
    borderRadius: 14,
    background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
    color: "#ffffff",
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(99, 102, 241, 0.22)",
  }

  const disabledButtonStyle = {
    padding: "15px 20px",
    fontSize: 16,
    fontWeight: "bold",
    border: "none",
    borderRadius: 14,
    background: "#cbd5e1",
    color: "#64748b",
    cursor: "not-allowed",
    boxShadow: "none",
  }

  const secondaryButtonStyle = {
    padding: "11px 16px",
    fontSize: 14,
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    color: "#ffffff",
    cursor: "pointer",
    backdropFilter: "blur(4px)",
  }

  const deleteButtonStyle = {
    marginLeft: 10,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#fb7185",
    color: "white",
    border: "none",
    borderRadius: 10,
    boxShadow: "0 8px 18px rgba(251, 113, 133, 0.22)",
    whiteSpace: "nowrap",
  }

  const editButtonStyle = {
    marginLeft: 10,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#eef2ff",
    color: "#4338ca",
    border: "1px solid #c7d2fe",
    borderRadius: 10,
    whiteSpace: "nowrap",
  }

  const saveButtonStyle = {
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
    borderRadius: 10,
  }

  const cancelButtonStyle = {
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#f8fafc",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
  }

  const accountDeleteButtonStyle = {
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
    borderRadius: 10,
    whiteSpace: "nowrap",
  }

  const statCardStyle = {
    flex: 1,
    minWidth: 190,
    backgroundColor: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 20,
    padding: 20,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  }

  const loginCardStyle = {
    maxWidth: 460,
    margin: "60px auto",
    backgroundColor: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 24,
    padding: 30,
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
  }

  if (!user) {
    return (
      <div style={pageStyle}>
        <div style={loginCardStyle}>
          <h1
            style={{
              fontSize: "clamp(36px, 8vw, 58px)",
              marginTop: 0,
              marginBottom: 24,
              color: "#0f172a",
              letterSpacing: -1,
            }}
          >
            Connexion
          </h1>

          <div style={{ display: "grid", gap: 14 }}>
            <input
              type="email"
              placeholder="Votre email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <button onClick={signIn} style={primaryButtonStyle}>
                Se connecter
              </button>

              <button
                onClick={signUp}
                style={{
                  ...primaryButtonStyle,
                  background: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #d1d5db",
                  boxShadow: "none",
                }}
              >
                Créer un compte
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={appStyle}>
        <div style={heroStyle}>
          <h1
            style={{
              fontSize: "clamp(34px, 8vw, 82px)",
              marginTop: 0,
              marginBottom: 14,
              color: "#ffffff",
              letterSpacing: -2,
              lineHeight: 0.95,
              textAlign: "center",
            }}
          >
            Mes comptes
          </h1>

          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div
              style={{
                display: "inline-block",
                padding: "15px 22px",
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.22)",
                fontSize: "clamp(22px, 5vw, 36px)",
                fontWeight: "bold",
                color: "#ffffff",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              Solde global : {formatCurrency(globalBalance)} €
            </div>
          </div>

          <div
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: 18,
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            Connecté : {user.email}
          </div>

          <div
            style={{
              maxWidth: 320,
              margin: "0 auto 24px auto",
            }}
          >
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                ...inputStyle,
                backgroundColor: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(255,255,255,0.35)",
                fontWeight: "bold",
              }}
            >
              <option value="all">Tous les mois</option>
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.9)",
              fontSize: 16,
              marginBottom: 24,
              fontWeight: "bold",
            }}
          >
            Période analysée : {getMonthLabel(selectedMonth)}
          </div>

          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "stretch",
              marginBottom: 22,
            }}
          >
            <div style={statCardStyle}>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.82)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Revenus cumulés
              </div>
              <div style={{ fontSize: 34, fontWeight: "bold", color: "#bbf7d0" }}>
                +{formatCurrency(totalIncomeGlobal)} €
              </div>
            </div>

            <div style={statCardStyle}>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.82)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Dépenses cumulées
              </div>
              <div style={{ fontSize: 34, fontWeight: "bold", color: "#fecdd3" }}>
                -{formatCurrency(totalExpenseGlobal)} €
              </div>
            </div>

            <div style={statCardStyle}>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.82)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Nombre de comptes
              </div>
              <div style={{ fontSize: 34, fontWeight: "bold" }}>
                {accounts.length}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <button onClick={signOut} style={secondaryButtonStyle}>
              Se déconnecter
            </button>
          </div>
        </div>

        {dueRecurringTransactions.length > 0 && (
          <div
            style={{
              ...sectionCardStyle,
              marginBottom: 26,
              border: "2px solid #93c5fd",
              backgroundColor: "#eff6ff",
            }}
          >
            <div
              style={{
                fontSize: "clamp(22px, 4vw, 28px)",
                fontWeight: "bold",
                marginBottom: 16,
                color: "#1d4ed8",
              }}
            >
              Récurrences à valider
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              {dueRecurringTransactions.map((item) => {
                const accountName =
                  accounts.find((a) => a.id === item.account_id)?.name || "Compte inconnu"

                return (
                  <div
                    key={item.id}
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #dbeafe",
                      borderRadius: 16,
                      padding: 16,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: 18, color: "#0f172a" }}>
                      {item.label}
                    </div>

                    <div style={{ color: "#334155" }}>
                      Compte : <strong>{accountName}</strong>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Catégorie :{" "}
                      <strong>{normalizeCategory(item.category) || "À classer"}</strong>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Échéance mensuelle : <strong>jour {item.day_of_month}</strong>
                    </div>

                    <div
                      style={{
                        fontWeight: "bold",
                        color: item.type === "expense" ? "#dc2626" : "#059669",
                      }}
                    >
                      {item.type === "expense" ? "Dépense" : "Revenu"} —{" "}
                      {formatCurrency(item.amount)} €
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => validateRecurringTransaction(item)}
                        style={saveButtonStyle}
                      >
                        Valider l'opération
                      </button>

                      <button
                        onClick={() => ignoreRecurringTransactionForThisMonth(item)}
                        style={cancelButtonStyle}
                      >
                        Ignorer ce mois-ci
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div
          style={{
            ...sectionCardStyle,
            marginBottom: 26,
            border: `2px solid ${financeInsight.border}`,
            backgroundColor: financeInsight.background,
          }}
        >
          <div
            style={{
              fontSize: "clamp(22px, 4vw, 28px)",
              fontWeight: "bold",
              marginBottom: 12,
              color: financeInsight.color,
            }}
          >
            Analyse intelligente — {financeInsight.title}
          </div>

          <div
            style={{
              fontSize: 18,
              lineHeight: 1.5,
              color: "#0f172a",
              marginBottom: topCategory ? 14 : 0,
            }}
          >
            {financeInsight.message}
          </div>

          {topCategory && totalExpenseGlobal > 0 && (
            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 10,
                color: "#334155",
              }}
            >
              <div>
                Catégorie dominante :{" "}
                <strong style={{ color: topCategory.color }}>
                  {topCategory.name}
                </strong>
              </div>
              <div>
                Poids dans les dépenses : <strong>{topCategory.percent}%</strong>
              </div>
              <div>
                Économie potentielle si tu réduis cette catégorie de 10% :{" "}
                <strong>{formatCurrency(estimatedSaving)} €</strong>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
            marginBottom: 26,
          }}
        >
          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Ajouter un compte</div>

            <div style={{ display: "grid", gap: 14 }}>
              <input
                type="text"
                placeholder="Nom du compte"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                step="0.01"
                placeholder="Solde initial"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                style={inputStyle}
                autoComplete="off"
              />

              <button
                onClick={addAccount}
                disabled={!isAccountFormValid}
                style={isAccountFormValid ? primaryButtonStyle : disabledButtonStyle}
              >
                Ajouter un compte
              </button>
            </div>
          </div>

          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Ajouter une transaction</div>

            <div style={{ display: "grid", gap: 14 }}>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                style={inputStyle}
              >
                <option value="">Choisir un compte</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>

              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={inputStyle}
              >
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </select>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={inputStyle}
              >
                <option value="">Choisir une catégorie</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Libellé"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                step="0.01"
                placeholder="Montant"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
              />

              <button
                onClick={addTransaction}
                disabled={!isTransactionFormValid}
                style={
                  isTransactionFormValid
                    ? primaryButtonStyle
                    : disabledButtonStyle
                }
              >
                Ajouter une transaction
              </button>
            </div>
          </div>
        </div>

        <div style={{ ...sectionCardStyle, marginBottom: 26 }}>
          <div style={sectionTitleStyle}>Récurrences mensuelles</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <select
                value={recurringAccountId}
                onChange={(e) => setRecurringAccountId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Choisir un compte</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>

              <select
                value={recurringType}
                onChange={(e) => setRecurringType(e.target.value)}
                style={inputStyle}
              >
                <option value="expense">Dépense</option>
                <option value="income">Revenu</option>
              </select>

              <select
                value={recurringCategory}
                onChange={(e) => setRecurringCategory(e.target.value)}
                style={inputStyle}
              >
                <option value="">Choisir une catégorie</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <input
                type="text"
                placeholder="Libellé"
                value={recurringLabel}
                onChange={(e) => setRecurringLabel(e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                step="0.01"
                placeholder="Montant"
                value={recurringAmount}
                onChange={(e) => setRecurringAmount(e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                min="1"
                max="31"
                placeholder="Jour du mois (1 à 31)"
                value={recurringDayOfMonth}
                onChange={(e) => setRecurringDayOfMonth(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <button
              onClick={addRecurringTransaction}
              disabled={!isRecurringFormValid}
              style={isRecurringFormValid ? primaryButtonStyle : disabledButtonStyle}
            >
              Ajouter une récurrence
            </button>
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: "bold",
              marginBottom: 14,
              color: "#0f172a",
            }}
          >
            Mes récurrences
          </div>

          {recurringTransactions.length === 0 ? (
            <div
              style={{
                color: "#6b7280",
                padding: "16px 18px",
                backgroundColor: "#f8fafc",
                borderRadius: 14,
                border: "1px solid #eceff3",
              }}
            >
              Aucune récurrence enregistrée.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {recurringTransactions.map((item) => {
                const accountName =
                  accounts.find((a) => a.id === item.account_id)?.name || "Compte inconnu"

                return (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gap: 10,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: "#ffffff",
                      border: "1px solid #edf1f5",
                      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 18, color: "#0f172a" }}>
                        {item.label}
                      </div>

                      <div
                        style={{
                          padding: "4px 10px",
                          borderRadius: 999,
                          backgroundColor: item.is_active ? "#dcfce7" : "#e2e8f0",
                          color: item.is_active ? "#166534" : "#475569",
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </div>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Compte : <strong>{accountName}</strong>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Type :{" "}
                      <strong>
                        {item.type === "expense" ? "Dépense" : "Revenu"}
                      </strong>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Catégorie :{" "}
                      <strong>{normalizeCategory(item.category) || "À classer"}</strong>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Montant : <strong>{formatCurrency(item.amount)} €</strong>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Jour du mois : <strong>{item.day_of_month}</strong>
                    </div>

                    <div style={{ color: "#334155" }}>
                      Dernier mois généré :{" "}
                      <strong>{item.last_generated_month || "Jamais"}</strong>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button
                        onClick={() => toggleRecurringTransaction(item)}
                        style={cancelButtonStyle}
                      >
                        {item.is_active ? "Désactiver" : "Activer"}
                      </button>

                      <button
                        onClick={() => deleteRecurringTransaction(item)}
                        style={deleteButtonStyle}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ ...sectionCardStyle, marginBottom: 26 }}>
          <div
            style={{
              ...sectionTitleStyle,
              textAlign: "center",
              marginBottom: 10,
              fontSize: "clamp(24px, 5vw, 34px)",
            }}
          >
            Répartition des dépenses par catégorie
          </div>

          {topCategory && (
            <div
              style={{
                textAlign: "center",
                marginBottom: 24,
                fontSize: 20,
                fontWeight: "bold",
                color: "#0f172a",
              }}
            >
              💸 Tu dépenses le plus en :
              <span style={{ color: topCategory.color }}>
                {" "}{topCategory.name}
              </span>{" "}
              ({formatCurrency(topCategory.value)} €)
            </div>
          )}

          {expenseByCategory.length === 0 ? (
            <p style={{ textAlign: "center", color: "#6b7280", marginBottom: 0 }}>
              Aucune dépense catégorisée pour le mois sélectionné.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {expenseByCategory.map((item) => (
                <div key={item.name}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontWeight: "bold",
                        color: "#0f172a",
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          backgroundColor: item.color,
                          display: "inline-block",
                        }}
                      />
                      {item.name}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        fontWeight: "bold",
                        color: "#334155",
                      }}
                    >
                      <span>{formatCurrency(item.value)} €</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "#64748b",
                          minWidth: 42,
                          textAlign: "right",
                        }}
                      >
                        {item.percent}%
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: 16,
                      backgroundColor: "#e5edf7",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${
                          maxExpenseCategoryValue > 0
                            ? (item.value / maxExpenseCategoryValue) * 100
                            : 0
                        }%`,
                        height: "100%",
                        backgroundColor: item.color,
                        borderRadius: 999,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={sectionCardStyle}>
          <div
            style={{
              ...sectionTitleStyle,
              textAlign: "center",
              marginBottom: 24,
              fontSize: "clamp(24px, 5vw, 34px)",
            }}
          >
            Mes comptes enregistrés
          </div>

          {accounts.length === 0 ? (
            <p style={{ color: "#6b7280", marginBottom: 0 }}>
              Aucun compte enregistré.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 24,
              }}
            >
              {accountsWithBalances.map((acc) => (
                <div
                  key={acc.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.7)",
                    borderRadius: 26,
                    padding: 24,
                    background:
                      "linear-gradient(145deg, rgba(255,255,255,0.96), rgba(248,250,252,0.92))",
                    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.1)",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-5px)"
                    e.currentTarget.style.boxShadow =
                      "0 25px 50px rgba(15,23,42,0.14)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0px)"
                    e.currentTarget.style.boxShadow =
                      "0 20px 40px rgba(15,23,42,0.1)"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      marginBottom: 18,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "clamp(24px, 5vw, 34px)",
                        fontWeight: "bold",
                        color: "#0f172a",
                        letterSpacing: -0.6,
                      }}
                    >
                      {acc.name}
                    </div>

                    <button
                      onClick={() => deleteAccount(acc.id, acc.name)}
                      style={accountDeleteButtonStyle}
                      title="Supprimer ce compte"
                    >
                      Supprimer le compte
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      marginBottom: 20,
                      color: "#475569",
                    }}
                  >
                    <div style={{ fontSize: 18 }}>
                      Solde initial : {formatCurrency(acc.initial_balance)} €
                    </div>

                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "clamp(24px, 5vw, 34px)",
                        marginTop: 4,
                        color: acc.currentBalance < 0 ? "#dc2626" : "#059669",
                        letterSpacing: -0.5,
                      }}
                    >
                      Solde actuel : {formatCurrency(acc.currentBalance)} €
                    </div>
                  </div>

                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: 14,
                      color: "#0f172a",
                      fontSize: 22,
                    }}
                  >
                    Historique
                  </div>

                  {acc.accountTransactions.length === 0 ? (
                    <div
                      style={{
                        color: "#6b7280",
                        padding: "16px 18px",
                        backgroundColor: "#f8fafc",
                        borderRadius: 14,
                        border: "1px solid #eceff3",
                      }}
                    >
                      Aucune transaction pour cette période
                    </div>
                  ) : (
                    <ul
                      style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "grid",
                        gap: 14,
                      }}
                    >
                      {acc.accountTransactions.map((t) => {
                        const isEditing = editingTransactionId === t.id
                        const displayCategory = normalizeCategory(t.category)

                        return (
                          <li
                            key={t.id}
                            style={{
                              padding: "16px 16px",
                              borderRadius: 16,
                              backgroundColor: "#ffffff",
                              border: "1px solid #edf1f5",
                              boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
                            }}
                          >
                            {isEditing ? (
                              <div style={{ display: "grid", gap: 12 }}>
                                <input
                                  type="text"
                                  value={editingLabel}
                                  onChange={(e) => setEditingLabel(e.target.value)}
                                  placeholder="Libellé"
                                  style={inputStyle}
                                />

                                <select
                                  value={editingCategory}
                                  onChange={(e) => setEditingCategory(e.target.value)}
                                  style={inputStyle}
                                >
                                  <option value="">Choisir une catégorie</option>
                                  {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={editingType}
                                  onChange={(e) => setEditingType(e.target.value)}
                                  style={inputStyle}
                                >
                                  <option value="expense">Dépense</option>
                                  <option value="income">Revenu</option>
                                </select>

                                <input
                                  type="number"
                                  step="0.01"
                                  value={editingAmount}
                                  onChange={(e) => setEditingAmount(e.target.value)}
                                  placeholder="Montant"
                                  style={inputStyle}
                                />

                                <div
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    onClick={saveEditedTransaction}
                                    disabled={!isEditingFormValid}
                                    style={
                                      isEditingFormValid
                                        ? saveButtonStyle
                                        : disabledButtonStyle
                                    }
                                  >
                                    Enregistrer
                                  </button>

                                  <button
                                    onClick={cancelEditingTransaction}
                                    style={cancelButtonStyle}
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 14,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ flex: 1, minWidth: 180 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 10,
                                      marginBottom: 6,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontWeight: "bold",
                                        color: "#0f172a",
                                        fontSize: 17,
                                      }}
                                    >
                                      {t.label}
                                    </div>

                                    <span
                                      style={{
                                        display: "inline-block",
                                        padding: "4px 10px",
                                        borderRadius: 999,
                                        backgroundColor: displayCategory
                                          ? getCategoryColor(displayCategory)
                                          : "#94a3b8",
                                        color: "#ffffff",
                                        fontSize: 12,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {displayCategory || "À classer"}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 13,
                                      color: "#64748b",
                                    }}
                                  >
                                    {new Date(t.date).toLocaleDateString()}
                                  </div>
                                </div>

                                <div
                                  style={{
                                    fontWeight: "bold",
                                    color:
                                      t.type === "expense" ? "#dc2626" : "#059669",
                                    whiteSpace: "nowrap",
                                    fontSize: 20,
                                  }}
                                >
                                  {t.type === "expense" ? "🔻 -" : "🔺 +"}
                                  {formatCurrency(t.amount)} €
                                </div>

                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => startEditingTransaction(t)}
                                    style={editButtonStyle}
                                  >
                                    Modifier
                                  </button>

                                  <button
                                    onClick={() => deleteTransaction(t.id)}
                                    style={deleteButtonStyle}
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App