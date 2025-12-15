import Link from "next/link";
import { Button } from "@heroui/react";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="text-default-600 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Button
            as={Link}
            href="/"
            color="primary"
            startContent={<Home className="w-4 h-4" />}
          >
            Go Home
          </Button>
          <Button
            as={Link}
            href="/search"
            variant="flat"
            startContent={<Search className="w-4 h-4" />}
          >
            Search Restaurants
          </Button>
        </div>
      </div>
    </div>
  );
}

