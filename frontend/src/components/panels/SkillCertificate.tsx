import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Student } from '../../types';
import type { CertificateView } from '../../utils/certificateView';

interface SkillCertificateProps {
  student: Student;
  teacherName: string;
  view: CertificateView;
  isClassOne: boolean;
  isClassTwo: boolean;
  certificateRef: React.RefObject<HTMLDivElement | null>;
}

export const SkillCertificate: React.FC<SkillCertificateProps> = ({
  student,
  teacherName,
  view,
  isClassOne,
  isClassTwo,
  certificateRef,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const issuedDate = view.issuedAt === 'Not available'
    ? view.issuedAt
    : new Date(view.issuedAt).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div
      ref={certificateRef}
      data-certificate-preview
      className={`skill-certificate ${isClassOne ? 'skill-certificate--class-one' : isClassTwo ? 'skill-certificate--class-two' : 'skill-certificate--default'}`}
    >
      <div className="skill-certificate__inner">
        <header className="skill-certificate__header">
          <p className="skill-certificate__portal">FLN PORTAL · FOUNDATIONAL LITERACY &amp; NUMERACY</p>
          <p className="skill-certificate__eyebrow">{t('certificate.skill.eyebrow')}</p>
          <h2 className="skill-certificate__title">{t('certificate.skill.title')}</h2>
          <p className="skill-certificate__intro">{t('certificate.skill.intro')}</p>
        </header>

        <section className="skill-certificate__recipient">
          <p>{t('certificate.skill.presentedTo')}</p>
          <h3>{student.name}</h3>
          <div className="skill-certificate__metadata">
            <span>{t('certificate.skill.class')}: <strong>{student.classGroup} · {student.section}</strong></span>
            <span>{t('certificate.skill.certificateId')}: <strong>{view.certificateId}</strong></span>
            <span>{t('certificate.skill.issuedAt')}: <strong>{issuedDate}</strong></span>
          </div>
        </section>

        <section className="skill-certificate__competencies" aria-label={t('certificate.skill.skills')}>
          {view.groups.map((group) => (
            <article className="skill-certificate__group" key={group.competency}>
              <div className="skill-certificate__group-heading">
                <h4>{group.competency === 'Other' ? t('certificate.skill.other') : group.competency}</h4>
                <span>{t('certificate.skill.competencyLevel')}: {t(`certificate.level.${group.level}`)}</span>
              </div>
              <ul>
                {group.concepts.map((concept) => (
                  <li key={concept.id} className="skill-certificate__concept">
                    <span className="skill-certificate__concept-main">
                      <span className="skill-certificate__icon" aria-hidden="true">{concept.icon}</span>
                      <span className="skill-certificate__concept-title">{concept.title}</span>
                      {concept.core && <span className="skill-certificate__core">{t('certificate.skill.core')}</span>}
                    </span>
                    <strong className="skill-certificate__level">{t(`certificate.level.${concept.level}`)}</strong>
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {view.groups.length === 0 && (
            <p className="skill-certificate__empty">{t('certificate.skill.noConceptDetails')}</p>
          )}
        </section>

        <footer className="skill-certificate__footer">
          <div>
            <strong>{teacherName}</strong>
            <span>{t('certificate.skill.teacherSignature')}</span>
          </div>
          <span className="skill-certificate__seal" aria-hidden="true">✿</span>
          <div>
            <strong>{issuedDate}</strong>
            <span>{t('certificate.skill.issuedAt')}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
