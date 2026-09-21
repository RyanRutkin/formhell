import { useState } from "react";
import "./DualPane.css";

export type PaneConfig = {
    title: string;
    content: React.ReactNode;
}

export function DualPane({ panes }: 
    { panes: PaneConfig[] }
) {
    const firstPane = panes[0];
    const [selectedPane, setSelectedPane] = useState<string>(firstPane?.title ?? "");
    return (
        <div className="dual-pane">
            <div className="dual-pane-toggle-container" >
                {
                    panes.map((pane, index) => (
                        <button
                            key={index}
                            className={`dual-pane-toggle raf-button ${selectedPane === pane.title ? 'active raf-button-primary' : 'raf-button-secondary'}`}
                            onClick={() => setSelectedPane(pane.title)}
                        >
                            {pane.title}
                        </button>
                    ))
                }
            </div>
            <div className="dual-pane-content-container">
                {
                    panes.map((pane, index) => (
                        <div key={index} className={`dual-pane-content ${selectedPane === pane.title ? 'active' : 'hidden'}`}>
                            {pane.content}
                        </div>
                    ))
                }
            </div>
        </div>
    );
}