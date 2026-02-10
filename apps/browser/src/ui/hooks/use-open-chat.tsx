import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

type OpenAgentState = [string | null, Dispatch<SetStateAction<string | null>>];

const OpenAgentContext = createContext<OpenAgentState>([null, () => {}]);

export const useOpenAgent = () => {
  const context = useContext(OpenAgentContext);
  if (!context) {
    throw new Error('useOpenAgent must be used within a OpenAgentProvider');
  }
  return context;
};

export const OpenAgentProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const state = useState<string | null>(null);
  return (
    <OpenAgentContext.Provider value={state}>
      {children}
    </OpenAgentContext.Provider>
  );
};
