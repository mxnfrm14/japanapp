import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<div className="flex items-center justify-center w-full"><h1 className="text-4xl font-bold">JapanApp - Coming Soon</h1></div>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
