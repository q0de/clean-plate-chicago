"use client";

export function RestaurantCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden animate-pulse">
      {/* Status Banner */}
      <div className="px-4 py-3 bg-gray-100">
        <div className="flex justify-between items-center">
          <div className="w-20 h-6 bg-gray-200 rounded-full" />
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Name */}
        <div className="w-3/4 h-6 bg-gray-200 rounded-lg mb-3" />
        
        {/* Address */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="flex-1 h-4 bg-gray-200 rounded-lg" />
        </div>
        
        {/* Date */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-gray-200 rounded" />
          <div className="w-32 h-4 bg-gray-200 rounded-lg" />
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <div className="w-20 h-4 bg-gray-200 rounded-lg" />
          <div className="w-16 h-5 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function RestaurantListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <RestaurantCardSkeleton key={i} />
      ))}
    </div>
  );
}
