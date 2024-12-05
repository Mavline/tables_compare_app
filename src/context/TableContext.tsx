import React, { createContext, useContext, useState } from 'react';

interface TableContextType {
  mergedData: any[] | null;
  saveMergedData: (data: any[]) => void;
  clearData: () => void;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const TableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mergedData, setMergedData] = useState<any[] | null>(null);

  const saveMergedData = (data: any[]) => {
    // Копируем данные, чтобы избежать мутаций
    const processedData = data.map(row => ({...row}));
    setMergedData(processedData);
  };

  const clearData = () => {
    setMergedData(null);
  };

  return (
    <TableContext.Provider value={{ mergedData, saveMergedData, clearData }}>
      {children}
    </TableContext.Provider>
  );
};

export const useTableContext = () => {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTableContext must be used within TableProvider');
  }
  return context;
}; 