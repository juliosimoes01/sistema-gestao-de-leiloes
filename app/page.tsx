import InventoryDashboard from '@/components/inventory-dashboard'
import { AuthGate } from '@/components/auth-gate'

export default function Page() {
  return (
    <AuthGate>
      <InventoryDashboard />
    </AuthGate>
  )
}
