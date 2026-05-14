import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getParentChildren, ParentChild } from "../api/parent";
import { useUser } from "./UserContext";

const ACTIVE_CHILD_KEY = "@e-dziennik:active-child-id";

type ParentContextType = {
  studentList: ParentChild[];
  activeChild: ParentChild | null;
  setActiveChild: (child: ParentChild) => void;
  loading: boolean;
  reload: () => void;
};

const ParentContext = createContext<ParentContextType>({
  studentList: [],
  activeChild: null,
  setActiveChild: () => {},
  loading: false,
  reload: () => {},
});

export const ParentProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const [studentList, setStudentList] = useState<ParentChild[]>([]);
  const [activeChild, setActiveChildState] = useState<ParentChild | null>(null);
  const [loading, setLoading] = useState(false);

  const isParent = user?.role?.toLowerCase() === "rodzic";

  const load = useCallback(async () => {
    if (!isParent) return;
    setLoading(true);
    try {
      const list = await getParentChildren();
      setStudentList(list);
      const storedId = await AsyncStorage.getItem(ACTIVE_CHILD_KEY).catch(() => null);
      const stored = storedId ? list.find((c) => c.id === Number(storedId)) : null;
      setActiveChildState(stored ?? list[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useEffect(() => {
    void load();
  }, [load]);

  const setActiveChild = useCallback(async (child: ParentChild) => {
    setActiveChildState(child);
    AsyncStorage.setItem(ACTIVE_CHILD_KEY, String(child.id)).catch(() => {});
  }, []);

  return (
    <ParentContext.Provider value={{ studentList, activeChild, setActiveChild, loading, reload: load }}>
      {children}
    </ParentContext.Provider>
  );
};

export const useParent = () => useContext(ParentContext);

export default function ParentContextRoute() {
  return null;
}
