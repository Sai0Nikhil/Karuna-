import React, { useState, useRef } from 'react';

interface ImageUploaderProps {
  onChange: (file: File | null, dataUrl: string | null) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onChange }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        onChange(file, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onChange(null, null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0] || null;
     if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        onChange(file, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Upload a photo of the animal:
      </label>
      
      {/* Hidden Inputs */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment" 
        className="hidden"
        onChange={handleFileChange}
      />

      {preview ? (
        <div className="rounded-lg overflow-hidden border-2 border-teal-500 shadow-md bg-white">
            <div className="relative h-64 bg-gray-100 flex items-center justify-center">
                <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                
                {/* Remove Button */}
                <button 
                    onClick={handleRemove}
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
                    aria-label="Remove image"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* Quick Actions Footer - Non-overlapping */}
            <div className="bg-slate-800 p-3 flex justify-center gap-6">
                 <button 
                    onClick={() => cameraInputRef.current?.click()} 
                    className="flex items-center gap-2 text-white text-sm font-medium hover:text-teal-300 transition-colors"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 2H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Retake
                 </button>
                 <div className="w-px bg-slate-600"></div>
                 <button 
                    onClick={() => galleryInputRef.current?.click()} 
                    className="flex items-center gap-2 text-white text-sm font-medium hover:text-teal-300 transition-colors"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    Change Photo
                 </button>
            </div>
        </div>
      ) : (
        <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-6 bg-gray-50 hover:bg-gray-100 transition-colors min-h-[250px]"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            <div className="text-center space-y-2">
                 <div className="mx-auto h-12 w-12 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                 </div>
                 <p className="text-gray-500 text-sm">Drag & drop here, or choose below</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-4">
                <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-lg shadow hover:bg-teal-700 transition-transform active:scale-95 font-bold"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 2H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    Take Photo
                </button>
                <button
                    onClick={() => galleryInputRef.current?.click()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white text-gray-700 border-2 border-gray-200 px-6 py-3 rounded-lg shadow-sm hover:border-teal-500 hover:text-teal-600 transition-colors font-bold"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    Select from Gallery
                </button>
            </div>
        </div>
      )}
    </div>
  );
};