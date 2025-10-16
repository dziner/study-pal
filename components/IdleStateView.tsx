import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface IdleStateViewProps {
    onFileSelected: (file: File) => void;
}

export const IdleStateView: React.FC<IdleStateViewProps> = ({ onFileSelected }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelected(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    }, [onFileSelected]);

    const handleClick = () => {
        inputRef.current?.click();
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelected(e.target.files[0]);
        }
    };

    return (
        <div 
            className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-100 p-4"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
        >
            <img 
                src="https://lh3.googleusercontent.com/d/1KqAh1lb2nSxlX13E1pJ4ME23MmnWUTWX" 
                alt="Kangmul and Joan" 
                className="w-32 h-32 rounded-full object-cover mb-6 shadow-lg border-4 border-white"
            />
            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-slate-800">Kangmul+Joan's AI Study Pal</h1>
                <p className="text-xl text-slate-600 mt-2">Your AI-powered learning companion</p>
            </div>
            
            <div 
                onClick={handleClick}
                className={`relative w-full max-w-lg p-10 bg-white rounded-2xl shadow-lg border-2 border-dashed transition-all duration-300 cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}
            >
                <div className="flex flex-col items-center justify-center text-center">
                    <div className={`p-4 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <UploadIcon className="h-12 w-12 text-slate-500"/>
                    </div>
                    <p className="mt-4 text-xl font-semibold text-slate-700">Drop your PDF or Image here</p>
                    <p className="text-sm text-slate-500 mt-1">Upload any study material and start learning with AI</p>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*"
                    onChange={handleFileChange}
                />
            </div>
            
            <p className="text-center text-slate-500 mt-8">
                Study Pal will analyze your document and help you understand it
                <br />
                through interactive Q&A
            </p>
            <p style={{ fontFamily: "'Mynerve', cursive" }} className="text-slate-500 text-base text-center mt-12">
                Powered by your daddy.
            </p>
        </div>
    );
};
