import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useProject } from '../context/ProjectContext';
import { Save, Code, Bot, Download } from 'lucide-react';

export default function CodePanel() {
  const { project, updateProject, generatedCode, isLoading, rlCode, setRlCode, loadRlTemplate } = useProject();
  const [activeTab, setActiveTab] = useState('generated');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('dqn');
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  React.useEffect(() => {
    if (project) {
      if (!rlCode) setRlCode(project.rl_code || '');
    }
  }, [project?.id]);

  if (!project) return null;

  const handleSave = () => {
    updateProject({ rl_code: rlCode });
  };

  const handleLoadTemplate = async () => {
    setIsLoadingTemplate(true);
    await loadRlTemplate(selectedAlgorithm);
    setIsLoadingTemplate(false);
  };

  const ALGORITHMS = [
    { value: 'dqn',       label: 'DQN' },
    { value: 'qlearning', label: 'Q-Learning' },
    { value: 'reinforce', label: 'REINFORCE' },
  ];

  const tabs = [
    { id: 'generated', label: 'Сгенерированный', icon: Code },
    { id: 'rl', label: 'RL Агент', icon: Bot },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="tabs-header">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab !== 'generated' && (
        <div style={{ 
          padding: '6px 12px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px',
          backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' 
        }}>
          {activeTab === 'rl' && (
            <>
              <select
                value={selectedAlgorithm}
                onChange={e => setSelectedAlgorithm(e.target.value)}
                style={{
                  fontSize: '11.5px', padding: '3px 6px',
                  backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer',
                }}
              >
                {ALGORITHMS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <button
                className="btn"
                onClick={handleLoadTemplate}
                disabled={isLoadingTemplate || isLoading}
                style={{ padding: '4px 10px', fontSize: '11.5px' }}
              >
                <Download size={12} />
                {isLoadingTemplate ? 'Загрузка...' : 'Шаблон'}
              </button>
            </>
          )}
          <button 
            className="btn" 
            onClick={handleSave}
            disabled={isLoading}
            style={{ padding: '4px 10px', fontSize: '11.5px' }}
          >
            <Save size={12} /> Сохранить
          </button>
        </div>
      )}

      <div className="tab-content" style={{ backgroundColor: 'var(--bg-surface)' }}>
        {activeTab === 'generated' && (
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="light"
            value={generatedCode || '# Нажмите "Сгенерировать" в панели инструментов'}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}
          />
        )}

        {activeTab === 'rl' && (
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="light"
            value={rlCode}
            onChange={setRlCode}
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        )}
      </div>
    </div>
  );
}
