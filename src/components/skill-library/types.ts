import type { Skill, UserSkill } from '../../shared/skills/types';

export interface SkillLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onUseSkill: (skill: Skill) => void;
  /** Solo se editan Skills del usuario: las del sistema son del producto. */
  onEditSkill: (skill: UserSkill) => void;
}

export interface SkillLibraryItemProps {
  skill: Skill;
  onUse: (skill: Skill) => void;
  onEdit: (skill: UserSkill) => void;
  onDelete: (id: string) => void;
}
