import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Shield, ShieldOff, UserPlus, Mail, Calendar, CheckCircle, XCircle, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface User {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  createdAt: string;
  lastLoginAt?: string;
  totalVotes?: number;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  // Get current user info to check if they're master admin
  useEffect(() => {
    // Check for multiple possible master admin emails
    const masterAdmins = ['chris.mcnulty@synozur.com', 'cmcnulty2000@yahoo.com'];
    // For admin panel access, assume master admin privileges
    setCurrentUserEmail('cmcnulty2000@yahoo.com');
  }, []);

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"]
    // Using default queryFn which includes auth headers automatically
  });

  // Promote/demote admin mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Include proper authentication headers
      const sessionId = localStorage.getItem('admin-session-id');
      if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }
      const authToken = localStorage.getItem('auth-token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`/api/admin/users/${userId}/admin`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ isAdmin: makeAdmin })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update admin status");
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.makeAdmin ? "User promoted" : "Admin rights removed",
        description: variables.makeAdmin 
          ? "User has been granted admin privileges."
          : "Admin privileges have been revoked.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowPromoteDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Operation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const headers: Record<string, string> = {};
      
      // Include proper authentication headers
      const sessionId = localStorage.getItem('admin-session-id');
      if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }
      const authToken = localStorage.getItem('auth-token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete user");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user account has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Resend verification email mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const headers: Record<string, string> = {};
      
      // Include proper authentication headers
      const sessionId = localStorage.getItem('admin-session-id');
      if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }
      const authToken = localStorage.getItem('auth-token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await apiRequest("POST", "/api/admin/resend-verification", { email }, headers);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resend verification email");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "A new verification email has been sent to the user.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send email",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const handlePromoteClick = (user: User) => {
    setSelectedUser(user);
    setShowPromoteDialog(true);
  };

  const handlePromoteConfirm = () => {
    if (selectedUser) {
      toggleAdminMutation.mutate({
        userId: selectedUser.id,
        makeAdmin: !selectedUser.isAdmin
      });
    }
  };

  const isMasterAdmin = users.find(u => u.email === currentUserEmail)?.isMasterAdmin || false;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-gray-500">Loading users...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts and admin privileges
              </CardDescription>
            </div>
            {isMasterAdmin && (
              <Badge className="bg-purple-100 text-purple-800">
                <Crown className="w-3 h-3 mr-1" />
                Master Admin
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search users by email, username, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">{users.length}</div>
              <div className="text-sm text-blue-700">Total Users</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">
                {users.filter(u => u.emailVerified).length}
              </div>
              <div className="text-sm text-green-700">Verified Users</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-900">
                {users.filter(u => u.isAdmin || u.isMasterAdmin).length}
              </div>
              <div className="text-sm text-purple-700">Admin Users</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-amber-900">
                {users.filter(u => u.lastLoginAt && 
                  new Date(u.lastLoginAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                ).length}
              </div>
              <div className="text-sm text-amber-700">Active (7 days)</div>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Votes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}`
                              : user.username || 'Unnamed User'}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {user.isMasterAdmin && (
                            <Badge className="bg-purple-100 text-purple-800 w-fit">
                              <Crown className="w-3 h-3 mr-1" />
                              Master Admin
                            </Badge>
                          )}
                          {user.isAdmin && !user.isMasterAdmin && (
                            <Badge className="bg-blue-100 text-blue-800 w-fit">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {user.emailVerified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600 w-fit">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-600 w-fit">
                              <XCircle className="w-3 h-3 mr-1" />
                              Unverified
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(user.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{user.totalVotes || 0}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!user.emailVerified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resendVerificationMutation.mutate(user.email)}
                              disabled={resendVerificationMutation.isPending}
                            >
                              <Mail className="w-3 h-3 mr-1" />
                              Resend Verification
                            </Button>
                          )}
                          {isMasterAdmin && !user.isMasterAdmin && (
                            <Button
                              size="sm"
                              variant={user.isAdmin ? "outline" : "default"}
                              onClick={() => handlePromoteClick(user)}
                              className={user.isAdmin ? "" : "bg-green-700 hover:bg-green-800"}
                            >
                              {user.isAdmin ? (
                                <>
                                  <ShieldOff className="w-3 h-3 mr-1" />
                                  Remove Admin
                                </>
                              ) : (
                                <>
                                  <Shield className="w-3 h-3 mr-1" />
                                  Make Admin
                                </>
                              )}
                            </Button>
                          )}
                          {!user.isMasterAdmin && !user.isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
                                  deleteUserMutation.mutate(user.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Info Alert */}
          {isMasterAdmin && (
            <Alert className="mt-6 border-purple-200 bg-purple-50">
              <Shield className="h-4 w-4 text-purple-600" />
              <AlertDescription className="text-purple-800">
                As the master admin, you can promote users to co-admin status. Co-admins have access to the admin panel but cannot promote other admins.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Promote/Demote Dialog */}
      <Dialog open={showPromoteDialog} onOpenChange={setShowPromoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.isAdmin ? "Remove Admin Privileges" : "Grant Admin Privileges"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.isAdmin 
                ? `Are you sure you want to remove admin privileges from ${selectedUser.email}? They will lose access to the admin panel.`
                : `Are you sure you want to grant admin privileges to ${selectedUser?.email}? They will have access to the admin panel and can manage photos and settings.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPromoteDialog(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePromoteConfirm}
              disabled={toggleAdminMutation.isPending}
              className={selectedUser?.isAdmin ? "bg-red-600 hover:bg-red-700" : "bg-green-700 hover:bg-green-800"}
            >
              {toggleAdminMutation.isPending 
                ? "Processing..." 
                : selectedUser?.isAdmin 
                  ? "Remove Admin" 
                  : "Make Admin"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}