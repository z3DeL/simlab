import React from 'react';
import { Play, AlignJustify, Server, GitBranch, Flag, Wrench, Shuffle, GitMerge, Eye, Gamepad2, Trophy, DoorOpen } from 'lucide-react';

export default function BlockPalette() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const PaletteItem = ({ type, icon: Icon, color, label }) => (
    <div className="palette-item" onDragStart={(e) => onDragStart(e, type)} draggable>
      <div style={{ 
        width: 28, height: 28, borderRadius: 'var(--radius-sm)', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}15`, border: `1px solid ${color}30`
      }}>
        <Icon size={14} color={color} />
      </div>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="palette">
      <div className="palette-section">
        <h3>Источники / Стоки</h3>
        <PaletteItem type="source" icon={Play} color="var(--color-source)" label="Генератор" />
        <PaletteItem type="sink" icon={Flag} color="var(--color-sink)" label="Сток" />
      </div>

      <div style={{ margin: '4px 12px', borderTop: '1px solid var(--border-color)' }} />

      <div className="palette-section">
        <h3>Обслуживание</h3>
        <PaletteItem type="queue" icon={AlignJustify} color="var(--color-queue)" label="Очередь" />
        <PaletteItem type="server" icon={Server} color="var(--color-server)" label="Сервер" />
      </div>

      <div style={{ margin: '4px 12px', borderTop: '1px solid var(--border-color)' }} />

      <div className="palette-section">
        <h3>Маршрутизация</h3>
        <PaletteItem type="branch" icon={GitBranch} color="var(--color-branch)" label="Ветвитель" />
        <PaletteItem type="router" icon={Shuffle} color="var(--color-router)" label="Маршрутизатор" />
        <PaletteItem type="merge" icon={GitMerge} color="var(--color-merge)" label="Слияние" />
      </div>

      <div style={{ margin: '4px 12px', borderTop: '1px solid var(--border-color)' }} />

      <div className="palette-section">
        <h3>Утилиты</h3>
        <PaletteItem type="custom" icon={Wrench} color="var(--color-custom)" label="Скрипт" />
        <PaletteItem type="gate" icon={DoorOpen} color="var(--color-gate)" label="Затвор" />
      </div>

      <div style={{ margin: '4px 12px', borderTop: '1px solid var(--border-color)' }} />

      <div className="palette-section">
        <h3>RL Агент</h3>
        <PaletteItem type="rl_observation" icon={Eye} color="var(--color-rl-obs)" label="Наблюдение" />
        <PaletteItem type="rl_action" icon={Gamepad2} color="var(--color-rl-act)" label="Действие" />
        <PaletteItem type="rl_reward" icon={Trophy} color="var(--color-rl-reward)" label="Награда" />
      </div>
      <div style={{ height: '8px' }} />
    </div>
  );
}
