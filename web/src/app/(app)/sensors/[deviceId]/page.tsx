import SensorDetail from '@/components/pages/SensorDetail'

// Next 16: route params arrive as a Promise and must be awaited.
export default async function SensorDetailPage({
  params,
}: {
  params: Promise<{ deviceId: string }>
}) {
  const { deviceId } = await params
  return <SensorDetail deviceId={deviceId} />
}
