import { useState, useEffect } from 'react';

const useTask = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api-task/list');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setTasks(data.data.tasks || data || []);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setError((err as any).message);
      console.error('获取任务列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const refreshTasks = () => {
    fetchTasks();
  };

  return {
    tasks,
    loading,
    error,
    refreshTasks,
  };
};

export default useTask;
