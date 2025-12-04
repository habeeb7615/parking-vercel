import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Settings, User, Car, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NavbarProps {
  onMobileMenuToggle?: () => void;
}

export function Navbar({ onMobileMenuToggle }: NavbarProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    // Navigation is handled by AuthContext signOut function
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-parkflow-red text-white";
      case "contractor":
        return "bg-parkflow-blue text-white";
      case "attendant":
        return "bg-parkflow-green text-white";
      default:
        return "bg-muted";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "contractor":
        return "Contractor";
      case "attendant":
        return "Attendant";
      default:
        return role;
    }
  };

  if (!profile) return null;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/50 backdrop-blur-xl supports-[backdrop-filter]:bg-white/30">
      <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 lg:px-6">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
            <Car className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-parkflow-blue flex-shrink-0" />
            <h1 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-parkflow-blue truncate">ParkFlow</h1>
          </div>
          <Badge className={`${getRoleColor(profile.role || '')} text-xs sm:text-sm hidden sm:inline-flex flex-shrink-0`}>
            {getRoleLabel(profile.role || '')}
          </Badge>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden relative z-50 h-8 w-8 sm:h-9 sm:w-9"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onMobileMenuToggle) {
                onMobileMenuToggle();
              }
            }}
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10 rounded-full">
                <Avatar className="h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10">
                  <AvatarImage src="" alt={profile.user_name || profile.email || 'User'} />
                  <AvatarFallback className="bg-parkflow-blue text-white text-xs sm:text-sm">
                    {(profile.user_name || profile.email || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 sm:w-56" align="end">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs sm:text-sm font-medium leading-none truncate">{profile.user_name || profile.email || 'User'}</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">{profile.email || 'No email'}</p>
                  <Badge className={`${getRoleColor(profile.role || '')} w-fit mt-2 text-xs`} variant="secondary">
                    {getRoleLabel(profile.role || '')}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/dashboard/profile")} className="text-xs sm:text-sm">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              {profile.role !== 'attendant' && (
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")} className="text-xs sm:text-sm">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-xs sm:text-sm">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

    </nav>
  );
}