import { JobFlowWizard } from '../JobCardForm/JobCardForm';

/** Counter Sale uses the shared Job Card engine with its shorter flow config. */
export default function CounterSaleWizard() {
  return <JobFlowWizard mode="counter-sale" />;
}
