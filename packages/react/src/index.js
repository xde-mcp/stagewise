import { initToolbar } from '@stagewise/toolbar';
import { useEffect } from 'react';
export function StagewiseToolbar({ config }) {
    useEffect(() => {
        initToolbar(config);
    }, [config]);
    return null;
}
