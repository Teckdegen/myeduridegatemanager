'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { School, SetupStep } from '@/lib/types';
import { SetupClasses } from '@/components/setup/SetupClasses';
import { SetupFields } from '@/components/setup/SetupFields';
import { SetupTeachers } from '@/components/setup/SetupTeachers';
import { SetupStudents } from '@/components/setup/SetupStudents';
import { CheckCircle, Circle, School as SchoolIcon } from 'lucide-react';

const STEPS: { key: SetupStep; label: string }[] = [
  { key: 'classes', label: 'Define Classes' },
  { key: 'fields', label: 'Custom Fields' },
  { key: 'teachers', label: 'Add Teachers' },
  { key: 'students', label: 'Add Students' },
];

export default function SchoolSetupPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [currentStep, setCurrentStep] = useState<SetupStep>('classes');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchSchool();
  }, []);

  const fetchSchool = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: role } = await supabase
      .from('user_school_roles')
      .select('school_id')
      .eq('user_id', user.id)
      .eq('role', 'school_admin')
      .single();

    if (!role) return;

    const { data: schoolData } = await supabase
      .from('schools')
      .select('*')
      .eq('id', role.school_id)
      .single();

    if (schoolData) {
      setSchool(schoolData);
      if (schoolData.setup_completed) {
        router.push('/dashboard/school-admin');
        return;
      }
      setCurrentStep(schoolData.setup_step || 'classes');
    }
    setLoading(false);
  };

  const handleStepComplete = async (nextStep: SetupStep | 'complete') => {
    if (!school) return;
    const supabase = createClient();

    if (nextStep === 'complete') {
      await supabase
        .from('schools')
        .update({ setup_completed: true, setup_step: 'complete' })
        .eq('id', school.id);
      router.push('/dashboard/school-admin');
    } else {
      await supabase
        .from('schools')
        .update({ setup_step: nextStep })
        .eq('id', school.id);
      setCurrentStep(nextStep);
    }
  };

  const getStepIndex = (step: SetupStep) => STEPS.findIndex(s => s.key === step);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-primary-600">Loading setup...</div>
      </div>
    );
  }

  if (!school) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <SchoolIcon size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Set Up {school.name}</h1>
            <p className="text-sm text-gray-500">Configure your school before adding students</p>
          </div>
        </div>
      </header>

      {/* Progress steps */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((step, idx) => {
              const isComplete = getStepIndex(currentStep) > idx;
              const isCurrent = step.key === currentStep;

              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 ${isCurrent ? 'text-primary-600' : isComplete ? 'text-green-600' : 'text-gray-400'}`}>
                    {isComplete ? (
                      <CheckCircle size={20} className="text-green-500" />
                    ) : (
                      <Circle size={20} className={isCurrent ? 'text-primary-600' : ''} />
                    )}
                    <span className={`text-sm font-medium ${isCurrent ? 'text-primary-700' : isComplete ? 'text-green-700' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 ${isComplete ? 'bg-green-300' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step content */}
      <main className="max-w-4xl mx-auto p-6">
        {currentStep === 'classes' && (
          <SetupClasses schoolId={school.id} onComplete={() => handleStepComplete('fields')} />
        )}
        {currentStep === 'fields' && (
          <SetupFields schoolId={school.id} onComplete={() => handleStepComplete('teachers')} />
        )}
        {currentStep === 'teachers' && (
          <SetupTeachers schoolId={school.id} onComplete={() => handleStepComplete('students')} />
        )}
        {currentStep === 'students' && (
          <SetupStudents schoolId={school.id} onComplete={() => handleStepComplete('complete')} />
        )}
      </main>
    </div>
  );
}
