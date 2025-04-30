import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-3xl">Analytics</h1>
            <p className="text-muted-foreground">View and analyze your data</p>
          </div>
          <Select defaultValue="7d">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Page Views</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">45,231</div>
              <p className="text-muted-foreground text-xs">
                +20.1% from last period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Unique Visitors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">12,234</div>
              <p className="text-muted-foreground text-xs">
                +15.3% from last period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Bounce Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">32.5%</div>
              <p className="text-muted-foreground text-xs">
                -2.5% from last period
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Avg. Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">4m 32s</div>
              <p className="text-muted-foreground text-xs">
                +12.3% from last period
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full rounded-md border p-4">
                <p className="text-center text-muted-foreground">
                  Traffic sources chart placeholder
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>User Behavior</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full rounded-md border p-4">
                <p className="text-center text-muted-foreground">
                  User behavior chart placeholder
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Page Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full rounded-md border p-4">
              <p className="text-center text-muted-foreground">
                Page performance chart placeholder
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
