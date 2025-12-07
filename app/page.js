'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { AlertCircle, Package, Store, TrendingDown, DollarSign, Download, Upload, Plus, Search, Edit, Trash2, History, CheckCircle } from 'lucide-react'

const App = () => {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stores, setStores] = useState([])
  const [inventory, setInventory] = useState([])
  const [alerts, setAlerts] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStore, setFilterStore] = useState('all')
  const [filterLowStock, setFilterLowStock] = useState(false)
  const { toast } = useToast()

  // Auth states
  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Dialog states
  const [showStoreDialog, setShowStoreDialog] = useState(false)
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [showAdjustDialog, setShowAdjustDialog] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)

  // Form states
  const [storeForm, setStoreForm] = useState({ name: '', location: '', contactEmail: '', contactPhone: '' })
  const [itemForm, setItemForm] = useState({ sku: '', productName: '', currentQuantity: 0, reorderLevel: 0, unitCost: 0, storeId: '' })
  const [adjustForm, setAdjustForm] = useState({ quantityChange: 0, changeType: 'adjustment', notes: '' })
  const [csvData, setCsvData] = useState('')
  const [importStoreId, setImportStoreId] = useState('')

  // API helper
  const api = async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    const response = await fetch(`/api${path}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Request failed')
    }
    return data
  }

  // Auth functions
  const handleAuth = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
      const data = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password, role: 'manager' })
      })
      setToken(data.token)
      setUser(data.user)
      localStorage.setItem('token', data.token)
      toast({ title: 'Success', description: data.message })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    setActiveTab('dashboard')
  }

  // Load data functions
  const loadDashboard = async () => {
    try {
      setLoading(true)
      const [statsData, alertsData] = await Promise.all([
        api('/dashboard/stats'),
        api('/alerts?resolved=false')
      ])
      setStats(statsData.stats)
      setAlerts(alertsData.alerts)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const loadStores = async () => {
    try {
      const data = await api('/stores')
      setStores(data.stores)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const loadInventory = async () => {
    try {
      setLoading(true)
      let query = ''
      if (searchTerm) query += `&search=${encodeURIComponent(searchTerm)}`
      if (filterStore !== 'all') query += `&storeId=${filterStore}`
      if (filterLowStock) query += `&lowStock=true`
      
      const data = await api(`/inventory?${query}`)
      setInventory(data.items)
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // CRUD functions
  const createStore = async () => {
    try {
      await api('/stores', {
        method: 'POST',
        body: JSON.stringify(storeForm)
      })
      toast({ title: 'Success', description: 'Store created successfully' })
      setShowStoreDialog(false)
      setStoreForm({ name: '', location: '', contactEmail: '', contactPhone: '' })
      loadStores()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const createOrUpdateItem = async () => {
    try {
      if (editingItem) {
        await api(`/inventory/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(itemForm)
        })
        toast({ title: 'Success', description: 'Item updated successfully' })
      } else {
        await api('/inventory', {
          method: 'POST',
          body: JSON.stringify(itemForm)
        })
        toast({ title: 'Success', description: 'Item created successfully' })
      }
      setShowItemDialog(false)
      setEditingItem(null)
      setItemForm({ sku: '', productName: '', currentQuantity: 0, reorderLevel: 0, unitCost: 0, storeId: '' })
      loadInventory()
      if (activeTab === 'dashboard') loadDashboard()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const deleteItem = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    try {
      await api(`/inventory/${id}`, { method: 'DELETE' })
      toast({ title: 'Success', description: 'Item deleted successfully' })
      loadInventory()
      if (activeTab === 'dashboard') loadDashboard()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const adjustInventory = async () => {
    try {
      await api('/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({ itemId: selectedItem.id, ...adjustForm })
      })
      toast({ title: 'Success', description: 'Inventory adjusted successfully' })
      setShowAdjustDialog(false)
      setSelectedItem(null)
      setAdjustForm({ quantityChange: 0, changeType: 'adjustment', notes: '' })
      loadInventory()
      if (activeTab === 'dashboard') loadDashboard()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const resolveAlert = async (alertId) => {
    try {
      await api(`/alerts/${alertId}/resolve`, { method: 'PUT' })
      toast({ title: 'Success', description: 'Alert resolved' })
      loadDashboard()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const exportInventory = async () => {
    try {
      const response = await fetch('/api/inventory/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      toast({ title: 'Success', description: 'Inventory exported successfully' })
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const importInventory = async () => {
    try {
      await api('/inventory/import', {
        method: 'POST',
        body: JSON.stringify({ csvData, storeId: importStoreId })
      })
      toast({ title: 'Success', description: 'Inventory imported successfully' })
      setShowImportDialog(false)
      setCsvData('')
      setImportStoreId('')
      loadInventory()
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setCsvData(event.target.result)
      }
      reader.readAsText(file)
    }
  }

  // Effects
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    if (savedToken) {
      setToken(savedToken)
    }
  }, [])

  useEffect(() => {
    if (token) {
      loadStores()
      if (activeTab === 'dashboard') {
        loadDashboard()
      } else if (activeTab === 'inventory') {
        loadInventory()
      }
    }
  }, [token, activeTab])

  useEffect(() => {
    if (token && activeTab === 'inventory') {
      loadInventory()
    }
  }, [searchTerm, filterStore, filterLowStock])

  // Not logged in
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Store Inventory Tracker</CardTitle>
            <CardDescription className="text-center">
              {authMode === 'login' ? 'Sign in to your account' : 'Create a new account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                >
                  {authMode === 'login' ? 'Sign Up' : 'Sign In'}
                </button>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main app
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Toaster />
      
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Inventory Tracker</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome, {user?.username}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="stores">Stores</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalItems || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stores</CardTitle>
                  <Store className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalStores || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.activeAlerts || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats.lowStockCount || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Value</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.totalValue || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Reorder Alerts</CardTitle>
                <CardDescription>Items that need to be reordered</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No active alerts</p>
                ) : (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <div>
                            <p className="font-medium">{alert.productName}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {alert.sku} | {alert.storeName} | Current: {alert.currentQuantity} | Reorder Level: {alert.reorderLevel}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => resolveAlert(alert.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Inventory Management</CardTitle>
                    <CardDescription>Manage your inventory items</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
                      <Upload className="h-4 w-4 mr-1" />
                      Import
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportInventory}>
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                    <Button size="sm" onClick={() => {
                      setEditingItem(null)
                      setItemForm({ sku: '', productName: '', currentQuantity: 0, reorderLevel: 0, unitCost: 0, storeId: '' })
                      setShowItemDialog(true)
                    }}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex gap-4 mb-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by SKU or product name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <Select value={filterStore} onValueChange={setFilterStore}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by store" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stores</SelectItem>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={filterLowStock ? "default" : "outline"}
                    onClick={() => setFilterLowStock(!filterLowStock)}
                  >
                    {filterLowStock ? 'Show All' : 'Low Stock Only'}
                  </Button>
                </div>

                {/* Table */}
                {loading ? (
                  <p className="text-center py-8">Loading...</p>
                ) : inventory.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No items found</p>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Store</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Reorder Level</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">Total Value</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.sku}</TableCell>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.storeName}</TableCell>
                            <TableCell className="text-right">{item.currentQuantity}</TableCell>
                            <TableCell className="text-right">{item.reorderLevel}</TableCell>
                            <TableCell className="text-right">${item.unitCost.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${(item.currentQuantity * item.unitCost).toFixed(2)}</TableCell>
                            <TableCell>
                              {item.currentQuantity <= item.reorderLevel ? (
                                <Badge variant="destructive">Low Stock</Badge>
                              ) : (
                                <Badge variant="secondary">Normal</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedItem(item)
                                    setShowAdjustDialog(true)
                                  }}
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingItem(item)
                                    setItemForm({
                                      sku: item.sku,
                                      productName: item.productName,
                                      currentQuantity: item.currentQuantity,
                                      reorderLevel: item.reorderLevel,
                                      unitCost: item.unitCost,
                                      storeId: item.storeId
                                    })
                                    setShowItemDialog(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stores Tab */}
          <TabsContent value="stores" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Store Management</CardTitle>
                    <CardDescription>Manage your store locations</CardDescription>
                  </div>
                  <Button onClick={() => setShowStoreDialog(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Store
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {stores.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No stores found. Add your first store!</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {stores.map((store) => (
                      <Card key={store.id}>
                        <CardHeader>
                          <CardTitle className="text-lg">{store.name}</CardTitle>
                          <CardDescription>{store.location}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1 text-sm">
                            {store.contactEmail && <p>Email: {store.contactEmail}</p>}
                            {store.contactPhone && <p>Phone: {store.contactPhone}</p>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Store Dialog */}
      <Dialog open={showStoreDialog} onOpenChange={setShowStoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Store</DialogTitle>
            <DialogDescription>Enter store details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="storeName">Store Name</Label>
              <Input
                id="storeName"
                value={storeForm.name}
                onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="storeLocation">Location</Label>
              <Input
                id="storeLocation"
                value={storeForm.location}
                onChange={(e) => setStoreForm({ ...storeForm, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="storeEmail">Contact Email</Label>
              <Input
                id="storeEmail"
                type="email"
                value={storeForm.contactEmail}
                onChange={(e) => setStoreForm({ ...storeForm, contactEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="storePhone">Contact Phone</Label>
              <Input
                id="storePhone"
                value={storeForm.contactPhone}
                onChange={(e) => setStoreForm({ ...storeForm, contactPhone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStoreDialog(false)}>Cancel</Button>
            <Button onClick={createStore}>Create Store</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            <DialogDescription>Enter item details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={itemForm.sku}
                onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                disabled={!!editingItem}
              />
            </div>
            <div>
              <Label htmlFor="productName">Product Name</Label>
              <Input
                id="productName"
                value={itemForm.productName}
                onChange={(e) => setItemForm({ ...itemForm, productName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="itemStore">Store</Label>
              <Select value={itemForm.storeId} onValueChange={(value) => setItemForm({ ...itemForm, storeId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="currentQuantity">Current Quantity</Label>
                <Input
                  id="currentQuantity"
                  type="number"
                  value={itemForm.currentQuantity}
                  onChange={(e) => setItemForm({ ...itemForm, currentQuantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  value={itemForm.reorderLevel}
                  onChange={(e) => setItemForm({ ...itemForm, reorderLevel: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="unitCost">Unit Cost ($)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  value={itemForm.unitCost}
                  onChange={(e) => setItemForm({ ...itemForm, unitCost: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancel</Button>
            <Button onClick={createOrUpdateItem}>{editingItem ? 'Update' : 'Create'} Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Inventory Dialog */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
            <DialogDescription>
              {selectedItem && `${selectedItem.productName} (${selectedItem.sku}) - Current: ${selectedItem.currentQuantity}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="quantityChange">Quantity Change</Label>
              <Input
                id="quantityChange"
                type="number"
                placeholder="Enter + or - amount"
                value={adjustForm.quantityChange}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantityChange: Number(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Use positive numbers to add, negative to subtract
              </p>
            </div>
            <div>
              <Label htmlFor="changeType">Change Type</Label>
              <Select value={adjustForm.changeType} onValueChange={(value) => setAdjustForm({ ...adjustForm, changeType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="reorder">Reorder</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="damage">Damage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustDialog(false)}>Cancel</Button>
            <Button onClick={adjustInventory}>Adjust</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Inventory</DialogTitle>
            <DialogDescription>
              Upload a CSV file with columns: SKU, Product Name, Current Quantity, Reorder Level, Unit Cost
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="importStore">Select Store</Label>
              <Select value={importStoreId} onValueChange={setImportStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="csvFile">CSV File</Label>
              <Input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={importInventory} disabled={!csvData || !importStoreId}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App