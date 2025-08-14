import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Settings, BarChart } from "lucide-react";
import { Link, useLocation } from "wouter";

interface UserData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
}

export default function UserProfile() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth-token');
      if (token) {
        try {
          const response = await fetch('/api/auth/status', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await response.json();
          if (data.authenticated && data.userId) {
            // Fetch user details
            const userResponse = await fetch('/api/auth/user', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (userResponse.ok) {
              const user = await userResponse.json();
              setUserData(user);
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      }
    };
    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth-token');
    setUserData(null);
    setLocation('/');
    window.location.reload(); // Force reload to update UI
  };

  if (!userData) {
    return null;
  }

  const initials = userData.firstName && userData.lastName
    ? `${userData.firstName[0]}${userData.lastName[0]}`
    : userData.email ? userData.email.substring(0, 2).toUpperCase()
    : 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            {userData.profileImageUrl && (
              <AvatarImage src={userData.profileImageUrl} alt={userData.email} />
            )}
            <AvatarFallback className="bg-green-100 text-green-700 font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {userData.firstName && userData.lastName 
                ? `${userData.firstName} ${userData.lastName}`
                : userData.username || 'User'}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {userData.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/profile">
          <DropdownMenuItem className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/user-stats">
          <DropdownMenuItem className="cursor-pointer">
            <BarChart className="mr-2 h-4 w-4" />
            <span>My Stats</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/settings">
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}