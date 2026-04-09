import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4 p-8">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900">404 Page Not Found</h1>
        <p className="text-gray-600 max-w-sm mx-auto">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <button className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium mt-4">
            Return to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
