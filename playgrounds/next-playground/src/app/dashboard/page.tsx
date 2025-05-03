import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-bold text-3xl">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to your admin dashboard
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">2,345</div>
              <p className="text-muted-foreground text-xs">
                +20.1% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Active Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">573</div>
              <p className="text-muted-foreground text-xs">
                +12.3% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">$12,345</div>
              <p className="text-muted-foreground text-xs">
                +8.5% from last month
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                Conversion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">3.2%</div>
              <p className="text-muted-foreground text-xs">
                +0.5% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              <div className="h-[350px] w-full rounded-md border p-4">
                <p className="text-center text-muted-foreground">
                  Chart placeholder - Would show analytics data here
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-4 rounded-md border p-4"
                  >
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm leading-none">
                        User Activity {i}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Description of the activity
                      </p>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {i}h ago
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
